const DEFAULT_CONFIG = {
  sheetId: "1dpTWl8ciiS_nU7UgbNmXq-1og9FmDwWiDUHVtDsde-U",
  gid: "1114581047",
  range: "A1:R",
};

const STORAGE_KEYS = {
  config: "excelwasa.dashboard.config",
  theme: "excelwasa.dashboard.theme",
};

const state = {
  rows: [],
  filteredRows: [],
  headers: [],
  config: loadConfig(),
};

const dom = {
  statsGrid: document.getElementById("statsGrid"),
  originBars: document.getElementById("originBars"),
  tableHead: document.getElementById("tableHead"),
  tableBody: document.getElementById("tableBody"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  themeToggle: document.getElementById("themeToggle"),
  openConfigBtn: document.getElementById("openConfigBtn"),
  configModal: document.getElementById("configModal"),
  sheetIdInput: document.getElementById("sheetIdInput"),
  gidInput: document.getElementById("gidInput"),
  rangeInput: document.getElementById("rangeInput"),
  saveConfigBtn: document.getElementById("saveConfigBtn"),
  resetDefaultsBtn: document.getElementById("resetDefaultsBtn"),
  lastUpdate: document.getElementById("lastUpdate"),
};

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || "{}") };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(cfg));
}

function makeUrl({ sheetId, gid, range }) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`;
  const params = new URLSearchParams({ gid, tq: "select *", headers: "1" });
  if (range) params.set("range", range);
  return `${base}?${params.toString()}`;
}

function parseGvizResponse(text) {
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Respuesta de Google Sheets inválida");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const cols = parsed.table.cols.map((col, idx) => col.label?.trim() || `Columna ${idx + 1}`);
  const rows = parsed.table.rows.map((r) => {
    const row = {};
    cols.forEach((colName, idx) => {
      const cell = r.c[idx];
      row[colName] = cell?.f ?? cell?.v ?? "";
    });
    return row;
  });

  return { cols, rows };
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value);

  const maybeTimestamp = Date.parse(str);
  if (!Number.isNaN(maybeTimestamp)) return new Date(maybeTimestamp);

  const gvizMatch = str.match(/Date\((\d+),(\d+),(\d+)/);
  if (!gvizMatch) return null;

  return new Date(Number(gvizMatch[1]), Number(gvizMatch[2]), Number(gvizMatch[3]));
}

function metricCards(rows) {
  const now = new Date();
  const thisMonth = rows.filter((r) => {
    const dt = normalizeDate(r.FechaCreacion || r.fechaCreacion);
    return dt && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
  }).length;

  const qualified = rows.filter((r) => String(r.Estado || "").toLowerCase().includes("calificado")).length;
  const withPhone = rows.filter((r) => Boolean(String(r.Telefono || r.TelefonoZAPI || "").trim())).length;
  const conversion = rows.length ? Math.round((qualified / rows.length) * 100) : 0;

  return [
    { label: "Total leads", value: rows.length, foot: "Registros importados" },
    { label: "Nuevos este mes", value: thisMonth, foot: "Por FechaCreacion" },
    { label: "Calificados", value: qualified, foot: `${conversion}% del total` },
    { label: "Con teléfono", value: withPhone, foot: `${rows.length ? Math.round((withPhone / rows.length) * 100) : 0}% con contacto` },
  ];
}

function renderStats(rows) {
  dom.statsGrid.innerHTML = "";
  metricCards(rows).forEach((item) => {
    const card = document.createElement("article");
    card.className = "stat glass";
    card.innerHTML = `
      <span class="stat-label">${item.label}</span>
      <div class="stat-value">${item.value}</div>
      <div class="stat-foot">${item.foot}</div>
    `;
    dom.statsGrid.appendChild(card);
  });
}

function renderOriginChart(rows) {
  const origins = rows.reduce((acc, row) => {
    const key = String(row.Origen || "Sin origen").trim() || "Sin origen";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(origins).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries[0]?.[1] || 1;

  dom.originBars.innerHTML = "";
  entries.forEach(([origin, count]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span>${origin}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div>
      <strong>${count}</strong>
    `;
    dom.originBars.appendChild(row);
  });
}

function renderTable() {
  const rows = state.filteredRows;
  dom.emptyState.style.display = rows.length ? "none" : "block";

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  dom.tableHead.innerHTML = `<tr>${state.headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  dom.tableBody.innerHTML = rows
    .map(
      (row) =>
        `<tr>${state.headers
          .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
          .join("")}</tr>`,
    )
    .join("");
}

function syncStatusFilterOptions(rows) {
  const statuses = [...new Set(rows.map((r) => String(r.Estado || "").trim()).filter(Boolean))].sort();
  dom.statusFilter.innerHTML = `<option value="">Todos los estados</option>${statuses
    .map((s) => `<option value="${s}">${s}</option>`)
    .join("")}`;
}

function applyFilters() {
  const query = dom.searchInput.value.trim().toLowerCase();
  const status = dom.statusFilter.value;

  state.filteredRows = state.rows.filter((row) => {
    const values = Object.values(row).join(" ").toLowerCase();
    const matchesSearch = query ? values.includes(query) : true;
    const matchesStatus = status ? String(row.Estado || "").trim() === status : true;
    return matchesSearch && matchesStatus;
  });

  renderTable();
}

async function loadSheet() {
  const url = makeUrl(state.config);
  dom.lastUpdate.textContent = "Cargando...";

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("No se pudo leer la hoja. Revisa permisos de compartición.");

    const text = await response.text();
    const { cols, rows } = parseGvizResponse(text);

    state.headers = cols;
    state.rows = rows;
    state.filteredRows = rows;

    renderStats(rows);
    renderOriginChart(rows);
    syncStatusFilterOptions(rows);
    renderTable();

    dom.lastUpdate.textContent = `Última carga: ${new Date().toLocaleString()}`;
  } catch (error) {
    dom.lastUpdate.textContent = `Error: ${error.message}`;
    state.headers = ["Aviso"];
    state.rows = [];
    state.filteredRows = [{ Aviso: "No se han podido cargar datos del Sheet. Abre configuración y revisa ID/GID/permisos." }];
    renderStats([]);
    renderOriginChart([]);
    renderTable();
  }
}

function setupTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  document.documentElement.dataset.theme = saved;

  dom.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(STORAGE_KEYS.theme, next);
  });
}

function setupConfigModal() {
  const fill = () => {
    dom.sheetIdInput.value = state.config.sheetId;
    dom.gidInput.value = state.config.gid;
    dom.rangeInput.value = state.config.range;
  };

  fill();

  dom.openConfigBtn.addEventListener("click", () => {
    fill();
    dom.configModal.showModal();
  });

  dom.resetDefaultsBtn.addEventListener("click", () => {
    state.config = { ...DEFAULT_CONFIG };
    saveConfig(state.config);
    fill();
  });

  dom.saveConfigBtn.addEventListener("click", () => {
    state.config = {
      sheetId: dom.sheetIdInput.value.trim(),
      gid: dom.gidInput.value.trim(),
      range: dom.rangeInput.value.trim(),
    };

    saveConfig(state.config);
    dom.configModal.close();
    loadSheet();
  });
}

function init() {
  setupTheme();
  setupConfigModal();
  dom.searchInput.addEventListener("input", applyFilters);
  dom.statusFilter.addEventListener("change", applyFilters);
  loadSheet();
}

init();
