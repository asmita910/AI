let alerts = [];
let sourceData = [];

let trendData = [];

let selectedAlertId = null;
let alertCount = 0;
let queueCount = 0;
const startTime = Date.now();

const els = {
  alertsList: document.querySelector("#alertsList"),
  sourceGrid: document.querySelector("#sourceGrid"),
  archiveRows: document.querySelector("#archiveRows"),
  barChart: document.querySelector("#barChart"),
  searchInput: document.querySelector("#searchInput"),
  priorityFilter: document.querySelector("#priorityFilter"),
  detailTitle: document.querySelector("#detailTitle"),
  detailPriority: document.querySelector("#detailPriority"),
  translatedText: document.querySelector("#translatedText"),
  summaryText: document.querySelector("#summaryText"),
  alertsMetric: document.querySelector("#alertsMetric"),
  queueMetric: document.querySelector("#queueMetric"),
  latencyMetric: document.querySelector("#latencyMetric"),
  sourcesMetric: document.querySelector("#sourcesMetric"),
  lastUpdated: document.querySelector("#lastUpdated"),
  toast: document.querySelector("#toast"),
  uptime: document.querySelector("#uptime"),
  reportText: document.querySelector("#reportText"),
  reportStatus: document.querySelector("#reportStatus"),
  addSourceForm: document.querySelector("#addSourceForm"),
  newSourceForm: document.querySelector("#newSourceForm"),
  showAddSourceBtn: document.querySelector("#showAddSourceBtn"),
  cancelAddSource: document.querySelector("#cancelAddSource"),
};

// --- API FETCHING ---
const API_URL = '/api';

async function fetchAlerts() {
  try {
    const response = await fetch(`${API_URL}/alerts`);
    const data = await response.json();
    
    if (data.length > alerts.length && alerts.length > 0) {
      showToast("New intelligence alert detected");
    }
    
    alerts = data;
    if (!selectedAlertId && alerts.length > 0) {
      selectedAlertId = alerts[0].id;
    }
    
    updateMetrics();
    updateTrendData();
    renderAlerts();
    renderDetail();
    renderArchive();
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
  }
}

async function refreshLiveNews() {
  const btn = document.querySelector("#refreshNewsBtn");
  if (!btn) return;
  
  const originalText = btn.textContent;
  btn.textContent = "Fetching...";
  btn.disabled = true;
  showToast("Fetching live intelligence... this may take up to a minute.");
  
  try {
    const response = await fetch(`${API_URL}/refresh-news`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      showToast("Live news fetched successfully!");
      await fetchAlerts();
    } else {
      showToast("Failed to fetch live news.");
    }
  } catch (err) {
    showToast("Error triggering live fetch.");
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function fetchSources() {
  try {
    const response = await fetch(`${API_URL}/sources`);
    sourceData = await response.json();
    renderSources();
    els.sourcesMetric.textContent = sourceData.length;
  } catch (err) {
    console.error('Failed to fetch sources:', err);
  }
}

async function addSource(source) {
  try {
    const response = await fetch(`${API_URL}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    });
    if (response.ok) {
      showToast("Source added successfully");
      fetchSources();
      els.addSourceForm.style.display = 'none';
      els.newSourceForm.reset();
    }
  } catch (err) {
    showToast("Error adding source");
  }
}

async function deleteSource(url) {
  if (!confirm("Are you sure you want to remove this monitoring source?")) return;
  try {
    const response = await fetch(`${API_URL}/sources?url=${encodeURIComponent(url)}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      showToast("Source removed");
      fetchSources();
    }
  } catch (err) {
    showToast("Error removing source");
  }
}



// --- UI RENDERING ---

function priorityLabel(priority) {
  return priority ? (priority.charAt(0).toUpperCase() + priority.slice(1)) : 'Unknown';
}

function filteredAlerts() {
  const term = els.searchInput.value.trim().toLowerCase();
  const priority = els.priorityFilter.value;
  return alerts.filter((alert) => {
    const matchesPriority = priority === "all" || alert.priority === priority;
    const haystack = `${alert.title} ${alert.source} ${alert.platform} ${alert.region} ${alert.summary}`.toLowerCase();
    return matchesPriority && haystack.includes(term);
  });
}

function renderAlerts() {
  const visible = filteredAlerts();
  els.alertsList.innerHTML = "";

  if (!visible.length) {
    els.alertsList.innerHTML = '<div class="translation-card"><div><span class="label">No matching alerts</span><p>Adjust the search term or priority filter.</p></div></div>';
    return;
  }

  visible.forEach((alert) => {
    const item = document.createElement("button");
    item.className = `alert-item ${alert.priority} ${alert.id === selectedAlertId ? "active" : ""}`;
    item.type = "button";
    item.innerHTML = `
      <div class="alert-title-row">
        <strong>${alert.title}</strong>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${alert.category ? `<span class="category-pill">${alert.category}</span>` : ''}
          <span class="priority-pill ${alert.priority}">${priorityLabel(alert.priority)}</span>
        </div>
      </div>
      <div class="alert-meta">
        <span>${alert.time}</span>
        <span>${alert.source}</span>
        <span>${alert.platform}</span>
        <span>${alert.region}</span>
      </div>
    `;
    item.addEventListener("click", () => {
      selectedAlertId = alert.id;
      renderAlerts();
      renderDetail();
    });
    els.alertsList.appendChild(item);
  });
}

function renderDetail() {
  const alert = alerts.find((item) => item.id === selectedAlertId) || filteredAlerts()[0] || (alerts.length > 0 ? alerts[0] : null);
  const matchedKeywordsEl = document.querySelector("#matchedKeywords");
  
  if (!alert) {
    els.detailTitle.textContent = "Select an alert";
    els.detailPriority.className = "priority-pill watch";
    els.detailPriority.textContent = "Watch";
    els.translatedText.textContent = "Translation will appear here.";
    els.summaryText.innerHTML = "<p>Select a live alert from the feed to view AI-generated summaries, news bullets, and matched keywords.</p>";
    if (matchedKeywordsEl) matchedKeywordsEl.innerHTML = '<span style="opacity: 0.6; font-size: 14px;">Select an alert</span>';
    return;
  }

  selectedAlertId = alert.id;
  els.detailTitle.textContent = alert.title;
  els.detailPriority.className = `priority-pill ${alert.priority}`;
  els.detailPriority.textContent = priorityLabel(alert.priority);
  els.translatedText.textContent = alert.translation;

  // Render matched keywords as pills
  if (matchedKeywordsEl) {
    const keywords = alert.matchedKeywords || [];
    if (keywords.length > 0) {
      matchedKeywordsEl.innerHTML = keywords.map(kw =>
        `<span class="keyword-pill ${alert.priority}">${kw}</span>`
      ).join('');
    } else {
      matchedKeywordsEl.innerHTML = '<span style="opacity: 0.5; font-size: 13px;">No keywords matched</span>';
    }
  }

  // Render summary with bullets
  let summaryHtml = `<p>${alert.summary || ''}</p>`;
  if (alert.bullets && alert.bullets.length > 0) {
    summaryHtml += '<ul class="bullet-list">' +
      alert.bullets.map(b => `<li>${b}</li>`).join('') +
      '</ul>';
  }
  els.summaryText.innerHTML = summaryHtml;
}

function renderSources() {
  els.sourceGrid.innerHTML = "";
  sourceData.forEach((source) => {
    const icon = source.platform.charAt(0);
    const health = source.health || 95;
    const card = document.createElement("article");
    card.className = "source-card";
    card.innerHTML = `
      <div class="source-card-header">
        <div class="brand">
          <div class="source-platform">${icon}</div>
          <div>
            <strong>${source.name}</strong>
            <span>${source.platform}</span>
          </div>
        </div>
        <span class="timestamp">${source.active ? 'ACTIVE' : 'INACTIVE'}</span>
      </div>
      <div class="source-stats">
        <span>${source.region || 'Global'}</span>
        <strong>${health}%</strong>
      </div>
      <div class="health"><span style="width:${health}%"></span></div>
      <div class="card-actions">
        <button class="delete-btn" onclick="deleteSource('${source.url}')">Remove</button>
      </div>
    `;
    els.sourceGrid.appendChild(card);
  });
}

function renderArchive() {
  els.archiveRows.innerHTML = "";
  alerts.forEach((alert) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${alert.time}</td>
      <td>${alert.source}<br><span class="timestamp">${alert.platform}</span></td>
      <td>${alert.region}</td>
      <td><span class="priority-pill ${alert.priority}">${priorityLabel(alert.priority)}</span></td>
      <td>${alert.summary}</td>
    `;
    els.archiveRows.appendChild(row);
  });
}

function updateTrendData() {
  if (!alerts.length) {
    trendData = [];
    return;
  }
  
  const counts = {};
  alerts.forEach(alert => {
    // Group by platform (Telegram, X, News Website, etc.)
    const type = alert.platform || "Web";
    counts[type] = (counts[type] || 0) + 1;
  });
  
  // Convert to sorted array for the chart
  trendData = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  renderTrends();
}

function renderTrends() {
  if (!trendData.length) {
    els.barChart.innerHTML = '<div class="translation-card"><p>No trend data available.</p></div>';
    return;
  }
  
  const max = Math.max(...trendData.map(([, value]) => value));
  els.barChart.innerHTML = "";
  trendData.forEach(([name, value]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <strong>${name}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
      <span>${value}</span>
    `;
    els.barChart.appendChild(row);
  });
}

function updateMetrics() {
  els.alertsMetric.textContent = alerts.length;
  els.queueMetric.textContent = Math.floor(alerts.length / 5);
  els.lastUpdated.textContent = "Updated now";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2100);
}

function generateReport(silent = false) {
  if (alerts.length === 0) return;
  const critical = alerts.filter((alert) => alert.priority === "critical").length;
  const high = alerts.filter((alert) => alert.priority === "high").length;
  els.reportStatus.textContent = "Generated now";
  els.reportText.innerHTML = `
    <div class="brief-section">
      <strong>Executive signal</strong>
      <p>${critical} critical and ${high} high-priority items were detected across monitored sources.</p>
    </div>
    <div class="brief-section">
      <strong>Priority developments</strong>
      <p>${alerts[0].summary}</p>
    </div>
    <div class="brief-section">
      <strong>Recommended next steps</strong>
      <p>Maintain translation review for high-confidence alerts, and share the current structured brief with response coordinators.</p>
    </div>
  `;
  if (!silent) {
    showToast("Daily brief generated");
  }
}

function exportArchive() {
  const header = ["time", "source", "platform", "region", "priority", "summary"];
  const rows = alerts.map((alert) => [alert.time, alert.source, alert.platform, alert.region, alert.priority, alert.summary]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "foa-intelligence-archive.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Archive CSV exported");
}

function updateUptime() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  els.uptime.textContent = `${h}:${m}:${s}`;
}

// --- EVENT LISTENERS ---

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".page-section").forEach((section) => section.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.section}`).classList.add("active");
  });
});

els.searchInput.addEventListener("input", renderAlerts);
els.priorityFilter.addEventListener("change", renderAlerts);
const refreshBtn = document.querySelector("#refreshNewsBtn");
if (refreshBtn) refreshBtn.addEventListener("click", refreshLiveNews);

document.querySelector("#ackBtn").addEventListener("click", () => showToast("Alert acknowledged"));
document.querySelector("#escalateBtn").addEventListener("click", () => showToast("Alert escalated to response team"));

document.querySelector("#copyBriefBtn").addEventListener("click", async () => {
  const alert = alerts.find((item) => item.id === selectedAlertId);
  if (!alert) return;
  const brief = `${alert.title}\nPriority: ${priorityLabel(alert.priority)}\nSource: ${alert.source} (${alert.platform})\n\n${alert.summary}`;
  try {
    await navigator.clipboard.writeText(brief);
    showToast("Brief copied");
  } catch {
    showToast("Failed to copy brief");
  }
});

document.querySelector("#refreshSourcesBtn").addEventListener("click", fetchSources);
document.querySelector("#exportArchiveBtn").addEventListener("click", exportArchive);
document.querySelector("#generateReportBtn").addEventListener("click", () => generateReport(false));

els.showAddSourceBtn.addEventListener("click", () => {
  els.addSourceForm.style.display = els.addSourceForm.style.display === 'none' ? 'block' : 'none';
});

els.cancelAddSource.addEventListener("click", () => {
  els.addSourceForm.style.display = 'none';
});

els.newSourceForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const source = {
    name: document.querySelector("#sourceName").value,
    platform: document.querySelector("#sourcePlatform").value,
    region: document.querySelector("#sourceRegion").value,
    url: document.querySelector("#sourceUrl").value,
    active: true
  };
  addSource(source);
});

// --- INITIALIZATION ---
fetchAlerts();
fetchSources();
setInterval(fetchAlerts, 5000); 
setInterval(updateUptime, 1000);
renderTrends();
