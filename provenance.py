"""provenance.py -- Stage 4: trace the footage. Where else has this frame appeared online?

If a clip is passed off as new but the same frame has been on the web since 2023, we say so.
Uses Cloud Vision web detection over the video's thumbnails (no download needed) via ADC, then
scrapes each matching page for a publish date to compare against this video's own upload date.

Public surface:
    provenance(url_or_id) -> models.Provenance

Smoke test:  python provenance.py <video_id_or_url>
"""
import logging
import os
import re
from datetime import datetime, date

import httpx

import models
from extract import parse_video_id, canonical_watch_url, thumbnail_urls

log = logging.getLogger("provenance")

_YOUTUBE_URL_RE = re.compile(r"(?:youtube\.com|youtu\.be)")

_client = None
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    # YouTube shows a cookie-consent interstitial (no uploadDate in the HTML) to traffic it
    # doesn't recognize -- notably requests from cloud/datacenter IPs like Cloud Run's. This
    # cookie tells YouTube consent was already given, so it serves the real watch page instead.
    "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+888",
}

# Matches schema.org-style dates embedded in a page: "uploadDate":"2019-05-01T12:00:00Z" etc.
# Covers YouTube's own watch pages (ld+json VideoObject) and many other sites that use the
# same schema.org convention. This is best-effort scraping -- pages that don't have this simply
# come back with date=None, which is a valid, expected outcome, not an error.
_DATE_PATTERNS = [
    re.compile(r'"uploadDate"\s*:\s*"([^"]+)"'),
    re.compile(r'"datePublished"\s*:\s*"([^"]+)"'),
    re.compile(r'<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"'),
    re.compile(r'<meta[^>]+itemprop="datePublished"[^>]+content="([^"]+)"'),
]


def _get_client():
    """Create the Vision client on first use so importing this module needs no creds."""
    global _client
    if _client is None:
        from google.cloud import vision
        _client = vision.ImageAnnotatorClient()
    return _client


def _youtube_publish_date(video_id: str) -> str | None:
    """Publish date for a YouTube video via the Data API. Reliable and fast -- avoids scraping
    watch pages, which Google serves a stripped-down bot-safe variant of (no date metadata) to
    traffic from datacenter IPs like Cloud Run's."""
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        return None
    try:
        resp = httpx.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "snippet", "id": video_id, "key": key},
            timeout=6,
        )
        if resp.status_code != 200:
            log.warning("YouTube Data API -> HTTP %s for %s", resp.status_code, video_id)
            return None
        items = resp.json().get("items", [])
        if not items:
            return None
        return items[0]["snippet"]["publishedAt"]
    except Exception as e:
        log.warning("YouTube Data API lookup failed for %s: %s", video_id, e)
        return None


def _scrape_date(page_url: str) -> str | None:
    """Best-effort: fetch a page and pull a publish/upload date out of its HTML.
    Returns an ISO date string, or None if we can't find one (a normal, valid outcome).
    YouTube URLs are routed to the Data API instead (see _youtube_publish_date)."""
    if _YOUTUBE_URL_RE.search(page_url):
        try:
            video_id = parse_video_id(page_url)
        except ValueError:
            return None
        return _youtube_publish_date(video_id)

    try:
        resp = httpx.get(page_url, headers=_HEADERS, timeout=6, follow_redirects=True)
        if resp.status_code != 200:
            log.warning("scrape %s -> HTTP %s (final url: %s)", page_url, resp.status_code, resp.url)
            return None
        html = resp.text
    except Exception as e:
        log.warning("scrape %s -> exception: %s", page_url, e)
        return None

    for pattern in _DATE_PATTERNS:
        m = pattern.search(html)
        if m:
            return m.group(1)
    log.warning("scrape %s -> 200 OK, %d bytes, no date pattern matched. snippet: %r",
                page_url, len(html), html[:300])
    return None


def _parse_date(raw: str | None) -> date | None:
    """Turn a scraped date string into a comparable date (ignoring time-of-day precision)."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


def provenance(url_or_id: str) -> models.Provenance:
    """Run web detection over the video's frames, date-check each match, and report whether
    the footage looks recycled (matches that predate this video's own upload)."""
    from google.cloud import vision

    video_id = parse_video_id(url_or_id)
    client = _get_client()

    full_pages: dict[str, models.MatchingImage] = {}
    partial_pages: dict[str, models.MatchingImage] = {}

    for thumb in thumbnail_urls(video_id):
        image = vision.Image()
        image.source.image_uri = thumb
        try:
            resp = client.web_detection(image=image)
        except Exception:
            # A single thumbnail failing (e.g. hq3 404s on short videos) is normal -- skip it.
            continue
        if resp.error.message:
            continue

        for page in resp.web_detection.pages_with_matching_images:
            if not page.url:
                continue
            if page.url in full_pages or page.url in partial_pages:
                continue  # already recorded from another thumbnail

            img_url = page.url
            if page.full_matching_images:
                img_url = page.full_matching_images[0].url
                bucket = full_pages
            elif page.partial_matching_images:
                img_url = page.partial_matching_images[0].url
                bucket = partial_pages
            else:
                bucket = partial_pages

            bucket[page.url] = models.MatchingImage(url=img_url, page_url=page.url)

    all_matches = {**full_pages, **partial_pages}

    # Scrape a date for each matching page (best-effort; missing dates are expected/normal).
    for mi in all_matches.values():
        mi.date = _scrape_date(mi.page_url)

    # This video's own upload date, via the same scrape approach.
    our_upload_raw = _scrape_date(canonical_watch_url(video_id))
    our_upload_date = _parse_date(our_upload_raw)

    likely_recycled = False
    if our_upload_date:
        for mi in all_matches.values():
            match_date = _parse_date(mi.date)
            if match_date and match_date < our_upload_date:
                likely_recycled = True
                break

    return models.Provenance(
        pages_with_matching_images=len(all_matches),
        full_matching_images=list(full_pages.values()),
        partial_matching_images=list(partial_pages.values()),
        likely_recycled=likely_recycled,
    )


if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv
    load_dotenv()

    vid = sys.argv[1] if len(sys.argv) > 1 else "klhX42PAzsk"
    result = provenance(vid)
    print(result.model_dump_json(indent=2))
    print(
        f"\n-- pages={result.pages_with_matching_images}, "
        f"full={len(result.full_matching_images)}, partial={len(result.partial_matching_images)}, "
        f"likely_recycled={result.likely_recycled}"
    )
