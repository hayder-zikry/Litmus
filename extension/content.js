// Litmus content script.
// Runs on every YouTube page. Its whole job:
//   1. Notice which Short you're watching (read the id out of the URL).
//   2. Notice when you scroll to a different Short (the URL changes).
//   3. If you stay on one Short past a threshold, treat that as "interested" and analyze it
//      for real against the live backend.
//   4. Show the result in a panel drawn on top of the page.

const API_BASE = "https://litmus-api-907722055477.asia-southeast1.run.app";
const DWELL_MS = 7000; // how long you must stay on a Short before we analyze it (~one loop)
const POLL_MS = 2000;

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

// ---- Real backend calls ----

async function analyzeShort(id) {
  showPanel(loadingHtml("Checking this Short..."));

  let job;
  try {
    const resp = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://www.youtube.com/shorts/${id}` }),
    });
    if (!resp.ok) throw new Error(`server returned ${resp.status}`);
    job = await resp.json();
  } catch (e) {
    if (id === currentVideoId) showPanel(errorHtml());
    return;
  }

  poll(id, job.job_id);
}

async function poll(id, jobId) {
  // Stop updating the panel if the user has scrolled away from this Short.
  if (id !== currentVideoId) return;

  let data;
  try {
    const resp = await fetch(`${API_BASE}/jobs/${jobId}`);
    data = await resp.json();
  } catch (e) {
    if (id === currentVideoId) showPanel(errorHtml());
    return;
  }

  if (id !== currentVideoId) return; // scrolled away while waiting

  if (data.status === "failed") {
    showPanel(errorHtml());
    return;
  }

  if (data.status === "done") {
    showPanel(resultHtml(data));
    return;
  }

  showPanel(loadingHtml(STATUS_LABELS[data.status] || "Checking this Short..."));
  setTimeout(() => poll(id, jobId), POLL_MS);
}

const STATUS_LABELS = {
  queued: "Queued...",
  extracting: "Watching the video...",
  verifying: "Checking claims against evidence...",
  tracing: "Tracing the footage...",
};

// ---- Rendering ----

function loadingHtml(label) {
  return `<div class="litmus-head">Litmus</div>
          <div class="litmus-loading">${label}</div>`;
}

function errorHtml() {
  return `<div class="litmus-head">Litmus</div>
          <div class="litmus-loading">Couldn't check this one. Try again later.</div>`;
}

function resultHtml(result) {
  const score = result.score || {};
  const claimsById = {};
  for (const c of (result.extraction && result.extraction.claims) || []) claimsById[c.id] = c;

  let scoreHtml;
  if (score.percentage === null || score.percentage === undefined) {
    scoreHtml = `<div class="litmus-score">No checkable claims found.</div>`;
  } else {
    const breakdown =
      `${score.refuted} refuted, ${score.disputed} disputed, ${score.unverified} unverified, ` +
      `of ${score.checkable_total} checkable`;
    const label = score.limited_evidence ? "Limited evidence available" : "Concern score";
    scoreHtml = `<div class="litmus-score">${label}: ${score.percentage}%</div>
                 <div class="litmus-breakdown">${breakdown}</div>`;
  }

  // Same three-bucket grouping as the website, for a consistent story.
  const misinformation = [];
  const mayBeTrue = [];
  let references = [];

  function footnote(v) {
    if (!v.evidence || v.evidence.length === 0) return "";
    references.push(v.evidence[0]);
    return ` <span class="litmus-footnote">[${references.length}]</span>`;
  }

  for (const v of result.verdicts || []) {
    if (v.verdict === "refuted" || v.verdict === "disputed") misinformation.push(v);
    else if (v.verdict === "supported") mayBeTrue.push(v);
  }

  function claimLi(v) {
    const claim = claimsById[v.claim_id];
    const text = claim ? claim.text : v.claim_id;
    return `<li><span class="litmus-verdict litmus-${v.verdict}">${v.verdict}</span>${text}${footnote(v)}</li>`;
  }

  const misinfoHtml = misinformation.length
    ? `<div class="litmus-section-head">Flagged as misinformation</div><ul class="litmus-claims">${misinformation.map(claimLi).join("")}</ul>`
    : "";
  const trueHtml = mayBeTrue.length
    ? `<div class="litmus-section-head">Flagged that may be true</div><ul class="litmus-claims">${mayBeTrue.map(claimLi).join("")}</ul>`
    : "";

  const recycled = result.provenance && result.provenance.likely_recycled
    ? `<div class="litmus-recycled">⚠ This footage appears to predate the video's upload.</div>`
    : "";

  const refsHtml = references.length
    ? `<div class="litmus-section-head">References</div>
       <ol class="litmus-refs">${references.map(e =>
         `<li><a href="${e.url}" target="_blank" rel="noopener">${e.title || e.url}</a></li>`
       ).join("")}</ol>`
    : "";

  return `<div class="litmus-head">Litmus</div>
          ${scoreHtml}
          ${recycled}
          ${misinfoHtml}
          ${trueHtml}
          ${refsHtml}`;
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
