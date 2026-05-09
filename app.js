const alerts = [
  {
    id: "a-101",
    time: "09:42",
    source: "Quds News Network",
    platform: "Telegram",
    region: "Jerusalem",
    priority: "critical",
    title: "Coordinated calls for rapid gathering near Old City gates",
    original: "دعوات للتجمع الفوري قرب أبواب البلدة القديمة بعد انتشار مقاطع من المكان.",
    translation: "Calls for immediate gathering near the Old City gates after videos from the location began circulating.",
    summary: "AI detected repeated cross-channel amplification of the same gathering call. The update is time-sensitive because it is spreading across Telegram and X within a short window.",
  },
  {
    id: "a-102",
    time: "09:36",
    source: "Temple Institute",
    platform: "Website",
    region: "Jerusalem",
    priority: "high",
    title: "New event notice published with unusually high resharing velocity",
    original: "הודעה חדשה פורסמה באתר ומתפשטת במהירות ברשתות החברתיות.",
    translation: "A new announcement was published on the site and is spreading rapidly across social networks.",
    summary: "The classifier marked the post as high priority because several monitored accounts reshared it within eight minutes and comments reference planned attendance.",
  },
  {
    id: "a-103",
    time: "09:28",
    source: "PNN",
    platform: "News Website",
    region: "Ramallah",
    priority: "watch",
    title: "Regional media repeats developing situation from local correspondents",
    original: "مصادر محلية تتحدث عن تطورات ميدانية وتدعو لمتابعة التحديثات.",
    translation: "Local sources are reporting field developments and calling for continued updates.",
    summary: "The item is relevant but still lacks corroboration from higher-confidence sources. Keep in the watch queue and compare against the next scrape cycle.",
  },
  {
    id: "a-104",
    time: "09:17",
    source: "AlQuds",
    platform: "Instagram",
    region: "Gaza",
    priority: "high",
    title: "Visual post shows crowd movement and receives fast engagement spike",
    original: "منشور مصور يظهر حركة حشود مع ارتفاع سريع في التفاعل.",
    translation: "A visual post shows crowd movement with a rapid rise in engagement.",
    summary: "Computer-vision tagging detected crowd density and the engagement trend exceeded normal baseline for this account by 3.4x.",
  },
];

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

let selectedAlertId = alerts[0].id;
let alertCount = 127;
let queueCount = 4;
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

function priorityLabel(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
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
        <span class="priority-pill ${alert.priority}">${priorityLabel(alert.priority)}</span>
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
  const alert = alerts.find((item) => item.id === selectedAlertId) || filteredAlerts()[0] || alerts[0];
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

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2100);
}

function simulateAlert() {
  const now = new Date();
  const generated = {
    id: `a-${Math.floor(Math.random() * 9000) + 1000}`,
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    source: "Beyadenu",
    platform: "X/Twitter",
    region: "Jerusalem",
    priority: Math.random() > 0.45 ? "high" : "critical",
    title: "Fresh cross-platform signal detected from monitored account cluster",
    original: "עדכון חדש מתפשט במהירות ומוזכר על ידי מספר חשבונות במקביל.",
    translation: "A new update is spreading rapidly and is being referenced by several accounts at the same time.",
    summary: "The system detected a synchronized signal across monitored accounts. Translation, relevance scoring, and priority classification completed automatically.",
  };
  alerts.unshift(generated);
  selectedAlertId = generated.id;
  alertCount += 1;
  queueCount = Math.max(0, queueCount - 1);
  els.alertsMetric.textContent = alertCount;
  els.queueMetric.textContent = queueCount;
  els.latencyMetric.textContent = `${Math.floor(Math.random() * 18) + 10}s`;
  els.lastUpdated.textContent = "Updated now";
  renderAlerts();
  renderDetail();
  renderArchive();
  showToast("New intelligence alert detected");
}

function generateReport(silent = false) {
  const critical = alerts.filter((alert) => alert.priority === "critical").length;
  const high = alerts.filter((alert) => alert.priority === "high").length;
  els.reportStatus.textContent = "Generated now";
  els.reportText.innerHTML = `
    <div class="brief-section">
      <strong>Executive signal</strong>
      <p>${critical} critical and ${high} high-priority items were detected across monitored sources, with Jerusalem producing the highest concentration of actionable updates.</p>
    </div>
    <div class="brief-section">
      <strong>Priority developments</strong>
      <p>${alerts[0].summary}</p>
    </div>
    <div class="brief-section">
      <strong>Recommended next steps</strong>
      <p>Keep Telegram and X/Twitter in accelerated polling mode, maintain translation review for high-confidence alerts, and share the current structured brief with response coordinators.</p>
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
document.querySelector("#simulateBtn").addEventListener("click", simulateAlert);
document.querySelector("#ackBtn").addEventListener("click", () => showToast("Alert acknowledged"));
document.querySelector("#escalateBtn").addEventListener("click", () => showToast("Alert escalated to response team"));
document.querySelector("#copyBriefBtn").addEventListener("click", async () => {
  const alert = alerts.find((item) => item.id === selectedAlertId);
  const brief = `${alert.title}\nPriority: ${priorityLabel(alert.priority)}\nSource: ${alert.source} (${alert.platform})\n\n${alert.summary}`;
  try {
    await navigator.clipboard.writeText(brief);
    showToast("Brief copied");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = brief;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    showToast("Brief copied");
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
document.querySelector("#generateReportBtn").addEventListener("click", generateReport);

renderAlerts();
renderDetail();
renderSources();
renderArchive();
renderTrends();
generateReport(true);
setInterval(updateUptime, 1000);
