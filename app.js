let alerts = [];
const sourceData = [
  { name: "Quds News Network", platform: "Telegram", icon: "T", health: 97, alerts: 31, cadence: "15 sec" },
  { name: "Temple Institute", platform: "Website", icon: "W", health: 94, alerts: 12, cadence: "60 sec" },
  { name: "AlQuds", platform: "Instagram", icon: "I", health: 88, alerts: 19, cadence: "45 sec" },
  { name: "Beyadenu", platform: "X/Twitter", icon: "X", health: 91, alerts: 15, cadence: "20 sec" },
  { name: "New Arab", platform: "News Website", icon: "N", health: 99, alerts: 8, cadence: "120 sec" },
  { name: "Regional Channels", platform: "YouTube", icon: "Y", health: 84, alerts: 7, cadence: "180 sec" },
];

const trendData = [
  ["Telegram", 42],
  ["X/Twitter", 31],
  ["Web", 25],
  ["Instagram", 19],
  ["YouTube", 10],
];

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
  originalText: document.querySelector("#originalText"),
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
};

// --- API FETCHING ---
const API_URL = '/api';

async function fetchAlerts() {
  try {
    const response = await fetch(`${API_URL}/alerts`);
    const data = await response.json();
    
    // Check if we have new alerts
    if (data.length > alerts.length && alerts.length > 0) {
      showToast("New intelligence alert detected");
    }
    
    alerts = data;
    if (!selectedAlertId && alerts.length > 0) {
      selectedAlertId = alerts[0].id;
    }
    
    updateMetrics();
    renderAlerts();
    renderDetail();
    renderArchive();
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
    showToast("Error connecting to live server");
  }
}

async function simulateHit() {
  try {
    const response = await fetch(`${API_URL}/simulate-hit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: "Manual Trigger",
        platform: "Web Console",
        region: "Jerusalem",
        priority: "high",
        title: "Manually triggered detection event",
        original: "حدث تم تحفيزه يدويا من لوحة التحكم.",
        translation: "An event manually triggered from the control panel.",
        summary: "This alert was generated manually to test the end-to-end notification pipeline.",
      })
    });
    const result = await response.json();
    if (result.success) {
      fetchAlerts();
    }
  } catch (err) {
    showToast("Failed to trigger simulation");
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
  if (alerts.length === 0) return;
  const alert = alerts.find((item) => item.id === selectedAlertId) || filteredAlerts()[0] || alerts[0];
  if (!alert) return;

  selectedAlertId = alert.id;
  els.detailTitle.textContent = alert.title;
  els.detailPriority.className = `priority-pill ${alert.priority}`;
  els.detailPriority.textContent = priorityLabel(alert.priority);
  els.originalText.textContent = alert.original;
  els.translatedText.textContent = alert.translation;
  els.summaryText.textContent = alert.summary;
}

function renderSources() {
  els.sourceGrid.innerHTML = "";
  sourceData.forEach((source) => {
    const card = document.createElement("article");
    card.className = "source-card";
    card.innerHTML = `
      <div class="source-card-header">
        <div class="brand">
          <div class="source-platform">${source.icon}</div>
          <div>
            <strong>${source.name}</strong>
            <span>${source.platform}</span>
          </div>
        </div>
        <span class="timestamp">${source.cadence}</span>
      </div>
      <div class="source-stats">
        <span>${source.alerts} alerts today</span>
        <strong>${source.health}%</strong>
      </div>
      <div class="health"><span style="width:${source.health}%"></span></div>
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

function renderTrends() {
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
document.querySelector("#simulateBtn").addEventListener("click", simulateHit);
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

document.querySelector("#refreshSourcesBtn").addEventListener("click", () => {
  sourceData.forEach((source) => {
    source.health = Math.min(99, Math.max(80, source.health + Math.floor(Math.random() * 7) - 3));
  });
  renderSources();
  showToast("Source health refreshed");
});

document.querySelector("#exportArchiveBtn").addEventListener("click", exportArchive);
document.querySelector("#generateReportBtn").addEventListener("click", () => generateReport(false));

// --- INITIALIZATION ---
fetchAlerts();
setInterval(fetchAlerts, 5000); // Poll every 5 seconds
renderSources();
renderTrends();
setInterval(updateUptime, 1000);
