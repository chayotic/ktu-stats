import './style.css';
import '@fontsource-variable/google-sans-code';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const batchMap = {
  "2015-19": { label: "2015-19", file: "2015-19.json", display: "2015 - 2019" },
  "2016-20": { label: "2016-20", file: "2016-20.json", display: "2016 - 2020" },
  "2017-21": { label: "2017-21", file: "2017-21.json", display: "2017 - 2021" },
  "2018-22": { label: "2018-22", file: "2018-22.json", display: "2018 - 2022" },
  "2020-24": { label: "2020-24", file: "2020-24.json", display: "2020 - 2024" },
  "2021-25": { label: "2021-25", file: "2021-25.json", display: "2021 - 2025" },
};

const historyBatches = [
  { label: "2016-20", file: "2016-20.json" },
  { label: "2017-21", file: "2017-21.json" },
  { label: "2018-22", file: "2018-22.json" },
  { label: "2020-24", file: "2020-24.json" },
  { label: "2021-25", file: "2021-25.json" },
];

let currentData = [];
let sortState = { key: "rate", dir: "desc" };
let chartInstance = null;

const overallValue = document.getElementById("overallValue");
const topList = document.getElementById("topList");
const tableBody = document.getElementById("tableBody");
const tableHeader = document.getElementById("tableHeader");
const searchInput = document.getElementById("searchInput");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalTableBody = document.getElementById("modalTableBody");
const historyChart = document.getElementById("historyChart");

// --- Persistent Theme ---
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
}

const themeToggle = document.getElementById("themeToggle");
const isDark = document.documentElement.classList.contains("dark");
themeToggle.querySelector(".material-symbols-outlined").textContent = isDark ? "light_mode" : "dark_mode";

async function fetchData(file) {
  const response = await fetch(`/data/${file}`);
  if (!response.ok) throw new Error(`Failed to load ${file}`);
  return response.json();
}

function calcRate(college) {
  const reg = college["Registered"];
  const pass = college["Passed"];
  return reg > 0 ? (pass / reg) * 100 : 0;
}

function getRank(data, institution) {
  return (
    [...data]
      .map((c) => ({ ...c, rate: calcRate(c) }))
      .sort((a, b) => b.rate - a.rate)
      .findIndex((c) => c.College === institution) + 1
  );
}

function renderTable(data, sortKey, sortDir) {
  const sorted = [...data].map((c) => ({ ...c, rate: calcRate(c) }));
  const rankSource = data.length === currentData.length ? data : currentData;

  sorted.sort((a, b) => {
    switch (sortKey) {
      case "rate":
        return sortDir === "asc" ? a.rate - b.rate : b.rate - a.rate;
      case "index":
        return sortDir === "asc"
          ? getRank(rankSource, a.College) - getRank(rankSource, b.College)
          : getRank(rankSource, b.College) - getRank(rankSource, a.College);
      case "name":
        return sortDir === "asc"
          ? a.College.localeCompare(b.College)
          : b.College.localeCompare(a.College);
      case "reg":
        return sortDir === "asc"
          ? a["Registered"] - b["Registered"]
          : b["Registered"] - a["Registered"];
      case "pass":
        return sortDir === "asc"
          ? a["Passed"] - b["Passed"]
          : b["Passed"] - a["Passed"];
      default:
        return 0;
    }
  });

  const query = searchInput.value.toLowerCase().trim();
  const isFiltered = !!query;

  if (sorted.length === 0 && isFiltered) {
    tableBody.innerHTML = `<div class="empty-state">No colleges found for "<span>${query}</span>"</div>`;
  } else {
    tableBody.innerHTML = sorted
      .map(
        (c) => `
      <div class="table-row" data-college="${c.College}">
        <span class="col-rank-val">${getRank(rankSource, c.College)}</span>
        <span class="col-name-val">${c.College}</span>
        <span class="col-num-val">${c["Registered"]}</span>
        <span class="col-num-val">${c["Passed"]}</span>
        <span class="col-rate-val">${c.rate.toFixed(2)}%</span>
      </div>
    `
      )
      .join("");

    document.querySelectorAll(".table-row").forEach((row) => {
      row.addEventListener("click", () => openModal(row.dataset.college));
    });
  }
}

function updateSortIndicators() {
  tableHeader.querySelectorAll("span").forEach((span) => {
    const key = span.dataset.sort;
    span.classList.remove("active");
    const arrow = span.querySelector(".sort-arrow");
    if (arrow) arrow.remove();
    if (key === sortState.key) {
      span.classList.add("active");
      const el = document.createElement("span");
      el.className = "sort-arrow";
      el.textContent = sortState.dir === "asc" ? "\u25B2" : "\u25BC";
      span.appendChild(el);
    }
  });
}

async function loadBatch(batch) {
  document.querySelectorAll(".batch-pill").forEach((b) => b.classList.remove("active"));
  document.querySelector(`.batch-pill[data-batch="${batch}"]`)?.classList.add("active");

  try {
    const data = (await fetchData(batchMap[batch].file)).filter(
      (c) => c["Registered"] > 0
    );
    currentData = data;
    searchInput.value = "";
    document.getElementById("searchClear").style.display = "none";
    const totalReg = data.reduce((s, c) => s + c["Registered"], 0);
    const totalPass = data.reduce((s, c) => s + c["Passed"], 0);
    overallValue.textContent =
      totalReg > 0 ? `${((totalPass / totalReg) * 100).toFixed(2)}%` : "--%";

    topList.innerHTML = [...data]
      .map((c) => ({ ...c, rate: calcRate(c) }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map(
        (c) => `
      <li><span>${c.College}</span><span>${c.rate.toFixed(2)}%</span></li>
    `
      )
      .join("");

    renderTable(data, sortState.key, sortState.dir);
  } catch {
    overallValue.textContent = "--%";
    topList.innerHTML = `<li style="color:var(--md-error)">Failed to load data</li>`;
    tableBody.innerHTML = `<div class="empty-state" style="color:var(--md-error)">Unable to load data</div>`;
  }
}

async function openModal(college) {
  try {
    const history = await Promise.all(
      historyBatches.map(async (b) => {
        const data = await fetchData(b.file);
        const entry = data.find((c) => c.College === college);
        if (!entry)
          return { ...b, rate: null, rank: "-", reg: "-", pass: "-" };
        const reg = entry["Registered"];
        const pass = entry["Passed"];
        const rate = reg > 0 ? ((pass / reg) * 100).toFixed(2) : "--";
        const rank =
          data
            .filter((c) => c["Registered"] > 0)
            .map((c) => ({
              ...c,
              r:
                c["Registered"] > 0
                  ? (c["Passed"] / c["Registered"]) * 100
                  : 0,
            }))
            .sort((a, b) => b.r - a.r)
            .findIndex((c) => c.College === college) + 1;
        return { ...b, rate, rank, reg, pass };
      })
    );

    modalTitle.textContent = college;

    if (chartInstance) chartInstance.destroy();
    const t = getChartTheme();
    chartInstance = new Chart(historyChart, {
      type: "line",
      data: {
        labels: history.map((h) => h.label),
        datasets: [
          {
            label: "Pass %",
            data: history.map((h) =>
              h.rate === null ? null : parseFloat(h.rate)
            ),
            borderColor: t.line,
            backgroundColor: t.fill,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: t.line,
            pointBorderColor: t.tooltipBg,
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            titleColor: t.tooltipTitle,
            bodyColor: t.tooltipBody,
            titleFont: {
              family: "'Google Sans Code Variable', monospace",
              size: 11,
            },
            bodyFont: {
              family: "'Google Sans Code Variable', monospace",
              size: 11,
            },
            borderColor: t.border,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: t.grid, drawBorder: false },
            ticks: {
              color: t.text,
              font: {
                family: "'Google Sans Code Variable', monospace",
                size: 10,
              },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: t.text,
              font: {
                family: "'Google Sans Code Variable', monospace",
                size: 10,
              },
            },
          },
        },
      },
    });

    modalTableBody.innerHTML = history
      .map(
        (h) => `
      <tr>
        <td>${h.label}</td>
        <td>${h.rank}</td>
        <td>${h.reg}</td>
        <td>${h.rate ? `${h.rate}%` : "--"}</td>
      </tr>
    `
      )
      .join("");

    modalOverlay.style.display = "flex";
  } catch (e) {
    console.error("Failed to load history:", e);
  }
}

document.querySelectorAll(".batch-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    loadBatch(btn.dataset.batch);
    searchInput.value = "";
    modalOverlay.style.display = "none";
  });
});

tableHeader.addEventListener("click", (e) => {
  const key = e.target.dataset.sort;
  if (!key) return;
  const dir =
    sortState.key === key && sortState.dir === "asc" ? "desc" : "asc";
  sortState = { key, dir };
  renderTable(currentData, key, dir);
  updateSortIndicators();
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = query
    ? currentData.filter((c) =>
        c.College.toLowerCase().includes(query)
      )
    : currentData;
  renderTable(filtered, sortState.key, sortState.dir);
  document.getElementById("searchClear").style.display = query ? "flex" : "none";
});

document.getElementById("searchClear").addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  renderTable(currentData, sortState.key, sortState.dir);
  document.getElementById("searchClear").style.display = "none";
});

modalClose.addEventListener("click", () => {
  modalOverlay.style.display = "none";
});

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) modalOverlay.style.display = "none";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalOverlay.style.display === "flex") {
    modalOverlay.style.display = "none";
  }
});

loadBatch("2021-25");

function getChartTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    text: isDark ? "rgba(255,255,255,0.4)" : "rgba(29, 30, 32,0.3)",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(29, 30, 32,0.06)",
    border: isDark ? "rgba(255,255,255,0.08)" : "rgba(29, 30, 32,0.08)",
    line: isDark ? "#e0e0e4" : "#1D1E20",
    fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(26,29,35,0.08)",
    tooltipBg: isDark ? "#121214" : "#ffffff",
    tooltipTitle: isDark ? "#e0e0e4" : "#1D1E20",
    tooltipBody: isDark ? "#777782" : "#5f6368",
  };
}

function applyChartTheme() {
  if (!chartInstance) return;
  const t = getChartTheme();
  chartInstance.data.datasets[0].borderColor = t.line;
  chartInstance.data.datasets[0].backgroundColor = t.fill;
  chartInstance.data.datasets[0].pointBackgroundColor = t.line;
  chartInstance.options.plugins.tooltip.backgroundColor = t.tooltipBg;
  chartInstance.options.plugins.tooltip.titleColor = t.tooltipTitle;
  chartInstance.options.plugins.tooltip.bodyColor = t.tooltipBody;
  chartInstance.options.plugins.tooltip.borderColor = t.border;
  chartInstance.options.scales.y.grid.color = t.grid;
  chartInstance.options.scales.y.ticks.color = t.text;
  chartInstance.options.scales.x.ticks.color = t.text;
  chartInstance.update();
}

themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  const isDark = document.documentElement.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.querySelector(".material-symbols-outlined").textContent = isDark ? "light_mode" : "dark_mode";
  applyChartTheme();
  const bar = document.querySelector(".top-bar");
  bar.style.backdropFilter = "none";
  bar.style.webkitBackdropFilter = "none";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.backdropFilter = "";
      bar.style.webkitBackdropFilter = "";
    });
  });
});
