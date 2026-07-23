// Litmus website -- paste-box fallback to the extension (the primary front door).
// Talks directly to the live Cloud Run backend. No build step, no framework: plain JS.

// Change this if the backend is ever redeployed under a different URL.
const API_BASE = "https://litmus-api-907722055477.asia-southeast1.run.app";

const inputView = document.getElementById("input-view");
const resultsView = document.getElementById("results-view");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const inputError = document.getElementById("input-error");
const statusLine = document.getElementById("status-line");
const backBtn = document.getElementById("back-btn");

const STATUS_LABELS = {
  queued: "Queued...",
  extracting: "Watching the video...",
  verifying: "Checking claims against evidence...",
  tracing: "Tracing the footage...",
  done: "Done.",
  failed: "Something went wrong.",
};

function showError(msg) {
  inputError.textContent = msg;
  inputError.classList.remove("hidden");
}

function clearError() {
  inputError.classList.add("hidden");
  inputError.textContent = "";
}

async function submit() {
  const url = urlInput.value.trim();
  clearError();
  if (!url) {
    showError("Paste a YouTube Shorts link first.");
    return;
  }

  submitBtn.disabled = true;
  statusLine.textContent = STATUS_LABELS.queued;
  statusLine.classList.remove("hidden");

  let job;
  try {
    const resp = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.detail || `Server returned ${resp.status}`);
    }
    job = await resp.json();
  } catch (e) {
    showError(e.message || "Could not reach the server.");
    submitBtn.disabled = false;
    statusLine.classList.add("hidden");
    return;
  }

  poll(job.job_id);
}

async function poll(jobId) {
  let data;
  try {
    const resp = await fetch(`${API_BASE}/jobs/${jobId}`);
    data = await resp.json();
  } catch (e) {
    showError("Lost connection to the server.");
    submitBtn.disabled = false;
    return;
  }

  statusLine.textContent = STATUS_LABELS[data.status] || data.status;

  if (data.status === "failed") {
    showError("Analysis failed. Try again, or try a different video.");
    submitBtn.disabled = false;
    statusLine.classList.add("hidden");
    return;
  }

  if (data.status === "done") {
    submitBtn.disabled = false;
    statusLine.classList.add("hidden");
    render(data);
    return;
  }

  setTimeout(() => poll(jobId), 2000);
}

// --- Rendering ---

function render(result) {
  renderScore(result.score);
  renderClaims(result);
  inputView.classList.add("hidden");
  resultsView.classList.remove("hidden");
}

function renderScore(score) {
  const el = document.getElementById("score-block");

  if (score.percentage === null || score.percentage === undefined) {
    el.innerHTML = `<div class="no-claims">No checkable claims found.</div>`;
    return;
  }

  const breakdown =
    `${score.refuted} refuted, ${score.disputed} disputed, ${score.unverified} unverified, ` +
    `of ${score.checkable_total} checkable claims`;

  const pct = score.percentage;
  const rotate = -90 + (pct / 100) * 180;

  const speedo = `
    <div class="speedo-wrap">
      <div class="speedo">
        <div class="speedo-mask"></div>
        <div class="speedo-needle" style="transform: translateX(-50%) rotate(-90deg);"></div>
        <div class="speedo-hub"></div>
      </div>
      <div class="speedo-scale"><span>Trustworthy</span><span>Mixed</span><span>Concern</span></div>
    </div>`;

  if (score.limited_evidence) {
    el.innerHTML = `
      <div class="limited-evidence">
        <div class="gauge-label">Limited evidence available</div>
        ${speedo}
        <div class="speedo-readout"><span class="pct">${pct}%</span></div>
        <div class="gauge-breakdown">${breakdown}</div>
      </div>`;
    animateNeedle(el, rotate);
    return;
  }

  el.innerHTML = `
    <div class="gauge-label">Concern score</div>
    ${speedo}
    <div class="speedo-readout"><span class="pct">${pct}%</span></div>
    <div class="gauge-breakdown">${breakdown}</div>`;
  animateNeedle(el, rotate);
}

// Needle starts pinned at 0 (-90deg) so it visibly sweeps to its reading.
// Two rAFs guarantee the browser has painted the starting position before
// the transition target is applied, so the CSS transition actually fires.
function animateNeedle(container, targetDeg) {
  const needle = container.querySelector(".speedo-needle");
  if (!needle) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      needle.style.transform = `translateX(-50%) rotate(${targetDeg}deg)`;
    });
  });
}

function renderClaims(result) {
  const claimsById = {};
  for (const c of (result.extraction?.claims || [])) claimsById[c.id] = c;

  const misinformation = [];
  const mayBeTrue = [];
  const cantCheck = [];

  for (const v of result.verdicts || []) {
    if (v.verdict === "refuted" || v.verdict === "disputed") misinformation.push(v);
    else if (v.verdict === "supported") mayBeTrue.push(v);
    else cantCheck.push(v); // unverified, not_checkable
  }

  const references = [];

  function footnote(verdict) {
    if (!verdict.evidence || verdict.evidence.length === 0) return "";
    const idx = references.length + 1;
    references.push(verdict.evidence[0]);
    return ` <span class="footnote">[${idx}]</span>`;
  }

  function renderList(elId, verdicts, withFootnotes) {
    const el = document.getElementById(elId);
    el.innerHTML = verdicts.map(v => {
      const claim = claimsById[v.claim_id];
      const text = claim ? claim.text : v.claim_id;
      const tag = `<span class="verdict-tag ${v.verdict}">${v.verdict}</span>`;
      const note = withFootnotes ? footnote(v) : "";
      return `<li>${tag}${text}${note}</li>`;
    }).join("");
  }

  // Order matters: footnote numbers are assigned as each list renders.
  renderList("list-misinformation", misinformation, true);
  renderList("list-may-be-true", mayBeTrue, true);
  renderList("list-cant-check", cantCheck, false);

  const refsEl = document.getElementById("references");
  refsEl.innerHTML = references.map(e =>
    `<li><a href="${e.url}" target="_blank" rel="noopener">${e.title || e.url}</a>${e.publisher ? ` -- ${e.publisher}` : ""}</li>`
  ).join("");
}

// --- Wiring ---

submitBtn.addEventListener("click", submit);
urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

backBtn.addEventListener("click", () => {
  resultsView.classList.add("hidden");
  inputView.classList.remove("hidden");
  urlInput.value = "";
});