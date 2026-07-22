// Litmus content script.
// Runs on every YouTube page. Its whole job right now:
//   1. Notice which Short you're watching (read the id out of the URL).
//   2. Notice when you scroll to a different Short (the URL changes).
//   3. If you stay on one Short past a threshold, treat that as "interested" and analyze it.
//   4. Show the result in a panel drawn on top of the page.
//
// There is NO real backend yet. Step 3 currently shows fake results after a short delay,
// so we can prove the detect -> wait -> show flow works. Swapping in the real backend later
// is a one-function change (see analyzeShort).

const DWELL_MS = 7000; // how long you must stay on a Short before we analyze it (~one loop)

let currentVideoId = null; // the Short we think is on screen
let dwellTimer = null; // the "have they stayed long enough?" countdown
let analyzedIds = new Set(); // don't re-analyze the same Short while it loops

// Pull the Short's id out of a URL like https://www.youtube.com/shorts/abc123
function getShortId() {
  const match = location.pathname.match(/^\/shorts\/([\w-]+)/);
  return match ? match[1] : null;
}

// Called whenever we might have landed on a new Short (page load OR scroll).
function onLocationMaybeChanged() {
  const id = getShortId();

  // Nothing changed since last check -> do nothing.
  if (id === currentVideoId) return;

  currentVideoId = id;

  // Any previous countdown is now stale (they moved on) -> cancel it. This is the token-saver:
  // scrolling away before the timer fires means we never spend anything.
  clearTimeout(dwellTimer);
  removePanel();

  // Not on a Short (e.g. the home feed) -> stop here.
  if (!id) return;

  // Already checked this one this session -> show nothing new, don't pay again.
  if (analyzedIds.has(id)) return;

  // Start the "are they actually watching?" countdown.
  dwellTimer = setTimeout(() => {
    analyzedIds.add(id);
    analyzeShort(id);
  }, DWELL_MS);
}

// Watch for the URL changing. YouTube swaps videos without reloading the page, so we can't rely
// on a fresh page load — we poll the URL a few times a second and react when it changes.
setInterval(onLocationMaybeChanged, 500);
onLocationMaybeChanged(); // also check right away on first load

// ---- The part that will eventually call the real backend ----
// For now it just shows a "checking" panel, waits, then fills in fake results.
function analyzeShort(id) {
  showPanel(loadingHtml());

  // FAKE: pretend the backend took 1.5s and returned this. Replace this whole block later with a
  // real request to the Litmus API and render its response instead.
  setTimeout(() => {
    // If they've already scrolled away, don't bother drawing over the new video.
    if (id !== currentVideoId) return;
    showPanel(resultHtml(FAKE_RESULT));
  }, 1500);
}

const FAKE_RESULT = {
  score: 58,
  breakdown: "2 refuted · 1 disputed · 1 unverified · of 4 checkable claims",
  claims: [
    { text: "Vaccines cause autism.", verdict: "refuted" },
    { text: "This footage is from last week.", verdict: "disputed" },
    { text: "The event happened in Paris.", verdict: "supported" },
    { text: "Officials confirmed the numbers privately.", verdict: "unverified" }
  ]
};

// ---- Drawing the panel ----
function loadingHtml() {
  return `<div class="litmus-head">Litmus</div>
          <div class="litmus-loading">Checking this Short…</div>`;
}

function resultHtml(r) {
  const claims = r.claims.map(c =>
    `<li><span class="litmus-verdict litmus-${c.verdict}">${c.verdict}</span> ${c.text}</li>`
  ).join("");
  return `<div class="litmus-head">Litmus</div>
          <div class="litmus-score">${r.score}% concern</div>
          <div class="litmus-breakdown">${r.breakdown}</div>
          <ul class="litmus-claims">${claims}</ul>`;
}

function showPanel(html) {
  let panel = document.getElementById("litmus-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "litmus-panel";
    document.body.appendChild(panel);
  }
  panel.innerHTML = html;
}

function removePanel() {
  const panel = document.getElementById("litmus-panel");
  if (panel) panel.remove();
}
