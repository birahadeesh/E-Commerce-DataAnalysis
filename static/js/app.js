/* ═══════════════════════════════════════════════════════════
   EcomStore Analytics — app.js
═══════════════════════════════════════════════════════════ */
'use strict';

// ── Palette ────────────────────────────────────────────────
const P = {
  purple:  '#8b5cf6', blue:    '#3b82f6', cyan:    '#06b6d4',
  emerald: '#10b981', amber:   '#f59e0b', rose:    '#f43f5e',
  indigo:  '#6366f1', teal:    '#14b8a6', orange:  '#f97316',
  pink:    '#ec4899',
  text:    '#94a3b8', grid:    'rgba(255,255,255,0.06)',
};
const CAT_COLORS  = [P.purple, P.cyan, P.amber, P.emerald, P.pink, P.blue, P.orange];
const REG_COLORS  = [P.blue, P.emerald, P.rose, P.indigo];
const SEG_COLORS  = [P.cyan, P.purple, P.amber];
const TIER_COLORS = [P.emerald, P.amber, P.rose];

// ── Chart defaults ─────────────────────────────────────────
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = P.text;
Chart.defaults.plugins.legend.labels.boxWidth = 12;

function gridOpts() {
  return { color: P.grid, drawBorder: false };
}
function tickOpts() {
  return { color: P.text, font: { size: 11 } };
}
function tooltipOpts(extra = {}) {
  return {
    backgroundColor: 'rgba(15,23,41,0.95)',
    titleColor: '#f0f4ff',
    bodyColor: P.text,
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 10,
    ...extra,
  };
}

// ── Helpers ────────────────────────────────────────────────
const fmt$  = v => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtN  = v => Number(v).toLocaleString('en-US');
const fmtPct= v => (v != null ? v.toFixed(1) + '%' : '—');

function rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16),
        g = parseInt(hex.slice(3,5),16),
        b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function animateCounter(el, target, isCurrency=false, suffix='') {
  const start = Date.now(), dur = 2200;   // ← slower, more satisfying
  const startVal = 0;
  function tick() {
    const pct  = Math.min((Date.now()-start)/dur, 1);
    const ease = 1 - Math.pow(1-pct, 4); // ease-out-quart: fast start, glides to stop
    const val  = startVal + (target - startVal) * ease;
    el.textContent = isCurrency ? fmt$(val) : (suffix ? val.toFixed(1)+suffix : fmtN(Math.round(val)));
    if (pct < 1) requestAnimationFrame(tick);
    else el.textContent = isCurrency ? fmt$(target) : (suffix ? target.toFixed(1)+suffix : fmtN(Math.round(target)));
  }
  requestAnimationFrame(tick);
}

function trendHTML(pct) {
  if (pct == null) return '';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '●';
  const cls   = pct > 0 ? 'trend-up' : pct < 0 ? 'trend-down' : 'trend-flat';
  const label = pct > 0 ? `+${pct}%` : `${pct}%`;
  return `<span class="${cls}">${arrow} ${label} vs prev year</span>`;
}

// ── Chart registry ─────────────────────────────────────────
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Filter state ───────────────────────────────────────────
function getFilters() {
  return `year=${document.getElementById('filterYear').value}&category=${document.getElementById('filterCategory').value}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

// ══════════════════════════════════════════════════════════
//  RENDER FUNCTIONS
// ══════════════════════════════════════════════════════════

// ── KPI Cards ─────────────────────────────────────────────
async function renderKPIs() {
  const data = await fetchJSON(`/api/kpis?${getFilters()}`);
  const k = data.kpis, y = data.yoy;

  const pairs = [
    ['v-sales',     k.revenue,        true,  '',    't-sales',     y.revenue],
    ['v-profit',    k.profit,         true,  '',    't-profit',    y.profit],
    ['v-margin',    k.profit_margin,  false, '%',   't-margin',    y.profit_margin],
    ['v-orders',    k.units,          false, '',    't-orders',    y.units],
    ['v-customers', k.products,       false, '',    't-customers', y.products],
    ['v-aov',       k.avg_rating,     false, '★',  't-aov',       y.avg_rating],
  ];

  pairs.forEach(([vid, val, isCurr, suf, tid, yoyPct]) => {
    const el = document.getElementById(vid);
    animateCounter(el, val, isCurr, suf);
    document.getElementById(tid).innerHTML = trendHTML(yoyPct);
  });
}

// ── YoY Bar Chart ─────────────────────────────────────────
async function renderYoY() {
  const d = await fetchJSON(`/api/yoy?${getFilters()}`);
  destroyChart('yoy');
  const ctx = document.getElementById('yoyChart').getContext('2d');
  charts['yoy'] = new Chart(ctx, {
    data: {
      labels: d.years,
      datasets: [
        {
          type: 'bar', label: 'Sales', data: d.sales, yAxisID: 'y',
          backgroundColor: rgba(P.purple, 0.7), borderRadius: 6,
        },
        {
          type: 'bar', label: 'Profit', data: d.profit, yAxisID: 'y',
          backgroundColor: rgba(P.emerald, 0.7), borderRadius: 6,
        },
        {
          type: 'line', label: 'Profit Margin %', data: d.profit_margin, yAxisID: 'y2',
          borderColor: P.amber, backgroundColor: rgba(P.amber, 0.15),
          fill: true, tension: 0.4, pointRadius: 5, borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts(), legend: { position: 'top' } },
      scales: {
        x:  { grid: gridOpts(), ticks: tickOpts() },
        y:  { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) }, position: 'left' },
        y2: { ticks: { ...tickOpts(), callback: v => v+'%' }, position: 'right', grid: { display: false } },
      },
    },
  });
}

// ── Sales Trend ────────────────────────────────────────────
async function renderTrend() {
  const d = await fetchJSON(`/api/sales-trend?${getFilters()}`);
  destroyChart('trend');
  const ctx = document.getElementById('trendChart').getContext('2d');
  charts['trend'] = new Chart(ctx, {
    data: {
      labels: d.labels,
      datasets: [
        {
          type: 'line', label: 'Sales', data: d.sales, yAxisID: 'y',
          borderColor: P.purple, backgroundColor: rgba(P.purple, 0.12),
          fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
        },
        {
          type: 'line', label: 'Profit', data: d.profit, yAxisID: 'y',
          borderColor: P.emerald, backgroundColor: rgba(P.emerald, 0.1),
          fill: true, tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x:  { grid: gridOpts(), ticks: { ...tickOpts(), maxTicksLimit: 12, maxRotation: 45 } },
        y:  { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── Category Donut ─────────────────────────────────────────
async function renderCategoryDonut() {
  const d = await fetchJSON(`/api/category?${getFilters()}`);
  destroyChart('catDonut');
  const ctx = document.getElementById('categoryDonut').getContext('2d');
  charts['catDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: d.labels,
      datasets: [{ data: d.sales, backgroundColor: CAT_COLORS, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.label}: ${fmt$(c.raw)}` } }),
        legend: { position: 'bottom' },
      },
      cutout: '65%',
    },
  });
}

// ── Category Margin Bar ────────────────────────────────────
async function renderCategoryMargin() {
  const d = await fetchJSON(`/api/category?${getFilters()}`);
  destroyChart('catMargin');
  const ctx = document.getElementById('categoryMarginChart').getContext('2d');
  charts['catMargin'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Sales', data: d.sales, backgroundColor: rgba(P.blue,0.7), borderRadius: 6 },
        { label: 'Profit', data: d.profit, backgroundColor: rgba(P.emerald,0.7), borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x: { grid: gridOpts(), ticks: tickOpts() },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── Sub-Category Profit Bar ────────────────────────────────
async function renderSubCategory() {
  const d = await fetchJSON(`/api/subcategory?${getFilters()}`);
  destroyChart('subcat');
  const ctx = document.getElementById('subcatChart').getContext('2d');
  const colors = d.profit.map(v => v >= 0 ? rgba(P.emerald,0.8) : rgba(P.rose,0.8));
  charts['subcat'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{ label: 'Profit', data: d.profit, backgroundColor: colors, borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` Profit: ${fmt$(c.raw)}` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
        y: { grid: { display: false }, ticks: { ...tickOpts(), font: { size: 10 } } },
      },
    },
  });
}

// ── Discount-Profit Impact Chart ───────────────────────────
async function renderDiscountProfit() {
  const d = await fetchJSON(`/api/profitability?${getFilters()}`);
  destroyChart('discProfit');

  // Stat pills
  const pillsEl = document.getElementById('profitPills');
  pillsEl.innerHTML = `
    <div class="stat-pill red">⚠️ Loss-making orders: ${d.loss_making_orders} (${d.loss_pct}%)</div>
    <div class="stat-pill green">✅ Profitable orders: ${(d.total_orders - d.loss_making_orders).toLocaleString()} (${(100 - d.loss_pct).toFixed(1)}%)</div>
  `;

  const ctx = document.getElementById('discountProfitChart').getContext('2d');
  const colors = d.discount_profit.map(v => v >= 0 ? rgba(P.emerald, 0.75) : rgba(P.rose, 0.75));
  charts['discProfit'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.discount_labels,
      datasets: [
        {
          label: 'Total Profit', data: d.discount_profit,
          backgroundColor: colors, borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` Profit: ${fmt$(c.raw)}` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), font: { size: 10 } }, title: { display: true, text: 'Discount Band', color: P.text, font: { size: 11 } } },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── Scatter: Discount vs Profit ────────────────────────────
async function renderScatter() {
  const d = await fetchJSON(`/api/discount-profit?${getFilters()}`);
  destroyChart('scatter');
  const ctx = document.getElementById('scatterChart').getContext('2d');

  const catSet = [...new Set(d.category)];
  const catColorMap = Object.fromEntries(catSet.map((c,i) => [c, CAT_COLORS[i % CAT_COLORS.length]]));

  const datasets = catSet.map(cat => {
    const pts = d.discount.map((disc, i) => d.category[i] === cat ? { x: disc*100, y: d.profit[i] } : null).filter(Boolean);
    return {
      label: cat, data: pts,
      backgroundColor: rgba(catColorMap[cat], 0.5),
      pointRadius: 4, pointHoverRadius: 6,
    };
  });

  charts['scatter'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: tooltipOpts({ callbacks: { label: c => ` Discount: ${c.raw.x.toFixed(0)}%  Profit: ${fmt$(c.raw.y)}` } }),
        legend: { position: 'top' },
      },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => v+'%' }, title: { display: true, text: 'Discount %', color: P.text } },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) }, title: { display: true, text: 'Profit ($)', color: P.text } },
      },
    },
  });
}

// ── Top Products ───────────────────────────────────────────
async function renderTopProducts() {
  const d = await fetchJSON(`/api/top-products?${getFilters()}`);
  destroyChart('topProd');
  const ctx = document.getElementById('topProductsChart').getContext('2d');
  charts['topProd'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Sales', data: d.sales, backgroundColor: rgba(P.purple,0.75), borderRadius: 5 },
        { label: 'Profit', data: d.profit, backgroundColor: rgba(P.cyan,0.7), borderRadius: 5 },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
        y: { grid: { display: false }, ticks: { ...tickOpts(), font:{ size: 10 } } },
      },
    },
  });
}

// ── High/Low Margin Products ───────────────────────────────
async function renderMarginProducts() {
  const d = await fetchJSON(`/api/profitability?${getFilters()}`);

  destroyChart('highMargin');
  const ctx1 = document.getElementById('highMarginChart').getContext('2d');
  charts['highMargin'] = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: d.high_margin_products,
      datasets: [{ label: 'Margin %', data: d.high_margin_values, backgroundColor: rgba(P.emerald,0.75), borderRadius: 5 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` Margin: ${c.raw.toFixed(1)}%` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => v+'%' } },
        y: { grid:{ display: false }, ticks: { ...tickOpts(), font:{ size: 10 } } },
      },
    },
  });

  destroyChart('lowMargin');
  const ctx2 = document.getElementById('lowMarginChart').getContext('2d');
  charts['lowMargin'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d.low_margin_products,
      datasets: [{ label: 'Margin %', data: d.low_margin_values, backgroundColor: rgba(P.rose,0.75), borderRadius: 5 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` Margin: ${c.raw.toFixed(1)}%` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => v+'%' } },
        y: { grid:{ display: false }, ticks: { ...tickOpts(), font:{ size: 10 } } },
      },
    },
  });
}

// ── Segment Charts ─────────────────────────────────────────
async function renderSegments() {
  const d = await fetchJSON(`/api/segment?${getFilters()}`);

  destroyChart('segDonut');
  const ctx1 = document.getElementById('segmentDonut').getContext('2d');
  charts['segDonut'] = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: d.labels,
      datasets: [{ data: d.sales, backgroundColor: SEG_COLORS, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.label}: ${fmt$(c.raw)}` } }),
        legend: { position: 'bottom' },
      },
      cutout: '65%',
    },
  });

  destroyChart('segMetrics');
  const ctx2 = document.getElementById('segmentMetricsChart').getContext('2d');
  charts['segMetrics'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Avg Order Value', data: d.aov, backgroundColor: rgba(P.cyan,0.75), borderRadius: 6 },
        { label: 'Revenue/Customer', data: d.revenue_per_customer, backgroundColor: rgba(P.amber,0.75), borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x: { grid: gridOpts(), ticks: tickOpts() },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── Customer Tier Chart ────────────────────────────────────
async function renderCustomerTiers() {
  const d = await fetchJSON(`/api/customer-value?${getFilters()}`);

  destroyChart('tier');
  const ctx = document.getElementById('tierChart').getContext('2d');
  charts['tier'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: d.tier_labels,
      datasets: [{ data: d.tier_count, backgroundColor: TIER_COLORS, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.label}: ${c.raw} customers (${fmt$(d.tier_sales[c.dataIndex])})` } }),
        legend: { position: 'bottom' },
      },
      cutout: '60%',
    },
  });

  // Top products table
  const tbody = document.getElementById('topCustomersTbody');
  const rows = d.top_customer_names.map((name, i) => {
    const prof    = d.top_customer_profit[i];
    const profCls = prof >= 0 ? 'green-val' : 'red-val';
    const seg     = d.top_customer_segment[i];
    const rating  = d.top_customer_rating ? d.top_customer_rating[i] : null;
    const units   = d.top_customer_orders[i];
    const starFull = rating ? Math.min(Math.round(rating), 5) : 0;
    const stars    = '★'.repeat(starFull) + '☆'.repeat(5 - starFull);
    return `<tr>
      <td class="rank-cell">${i+1}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${name}">${name}</td>
      <td><span class="cat-badge">${seg}</span></td>
      <td><span class="star-rating">${stars}</span> <small style="color:var(--text-muted);font-size:0.72rem">${rating ? rating.toFixed(1) : '—'}</small></td>
      <td style="font-weight:600">${fmt$(d.top_customer_sales[i])}</td>
      <td class="${profCls}">${fmt$(prof)}</td>
      <td style="color:var(--text-secondary)">${fmtN(units)}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="7" class="loading-cell">No data</td></tr>';
}

// ── Region Charts ──────────────────────────────────────────
async function renderRegion() {
  const d = await fetchJSON(`/api/region?${getFilters()}`);
  destroyChart('region');
  const ctx = document.getElementById('regionChart').getContext('2d');
  charts['region'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Sales',  data: d.sales,  backgroundColor: REG_COLORS.map(c => rgba(c,0.75)), borderRadius: 8 },
        { label: 'Profit', data: d.profit, backgroundColor: REG_COLORS.map(c => rgba(c,0.4)),  borderRadius: 8 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x: { grid: gridOpts(), ticks: tickOpts() },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── State Chart ────────────────────────────────────────────
async function renderState() {
  const d = await fetchJSON(`/api/state?${getFilters()}`);
  destroyChart('state');
  const ctx = document.getElementById('stateChart').getContext('2d');
  charts['state'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Sales',  data: d.sales,  backgroundColor: rgba(P.blue,0.75),    borderRadius: 5 },
        { label: 'Profit', data: d.profit, backgroundColor: rgba(P.emerald,0.65), borderRadius: 5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.dataset.label}: ${fmt$(c.raw)}` } }), legend: { position: 'top' } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), maxRotation: 40, font:{ size:10 } } },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });
}

// ── Shipping Charts ────────────────────────────────────────
async function renderShipping() {
  const d = await fetchJSON(`/api/shipmode?${getFilters()}`);
  const shipColors = [P.purple, P.cyan, P.emerald, P.amber];

  destroyChart('shipDonut');
  const ctx1 = document.getElementById('shipDonut').getContext('2d');
  charts['shipDonut'] = new Chart(ctx1, {
    type: 'doughnut',
    data: {
      labels: d.labels,
      datasets: [{ data: d.orders, backgroundColor: shipColors, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.label}: ${fmtN(c.raw)} orders` } }),
        legend: { position: 'bottom' },
      },
      cutout: '60%',
    },
  });

  destroyChart('shipSales');
  const ctx2 = document.getElementById('shipSalesChart').getContext('2d');
  charts['shipSales'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{ label: 'Sales', data: d.sales, backgroundColor: shipColors.map(c => rgba(c,0.75)), borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` Sales: ${fmt$(c.raw)}` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), font:{ size:10 } } },
        y: { grid: gridOpts(), ticks: { ...tickOpts(), callback: v => fmt$(v) } },
      },
    },
  });

  destroyChart('shipDays');
  const ctx3 = document.getElementById('shipDaysChart').getContext('2d');
  charts['shipDays'] = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{ label: 'Avg Days to Ship', data: d.avg_days, backgroundColor: shipColors.map(c => rgba(c,0.7)), borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: tooltipOpts({ callbacks: { label: c => ` ${c.raw} days avg` } }), legend: { display: false } },
      scales: {
        x: { grid: gridOpts(), ticks: { ...tickOpts(), font:{ size:10 } } },
        y: { grid: gridOpts(), ticks: tickOpts() },
      },
    },
  });
}

// ── Business Insights ──────────────────────────────────────
async function renderInsights() {
  const d = await fetchJSON(`/api/insights?${getFilters()}`);
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '';

  const typeGradients = {
    positive: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)',
    negative: 'linear-gradient(135deg, rgba(244,63,94,0.06), transparent)',
    warning:  'linear-gradient(135deg, rgba(245,158,11,0.06), transparent)',
    neutral:  'linear-gradient(135deg, rgba(59,130,246,0.06), transparent)',
  };

  d.insights.forEach((ins, i) => {
    const card = document.createElement('div');
    card.className = `insight-card ${ins.type}`;
    card.style.animationDelay = `${i * 0.1}s`;
    card.innerHTML = `
      <div class="insight-header">
        <div class="insight-icon-wrap">${ins.icon}</div>
        <span class="insight-title">${ins.title}</span>
      </div>
      <p class="insight-body">${ins.body}</p>
    `;
    grid.appendChild(card);
  });
}

// ══════════════════════════════════════════════════════════
//  LOAD ALL
// ══════════════════════════════════════════════════════════
async function loadAll() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
  try {
    await Promise.all([
      renderKPIs(),
      renderYoY(),
      renderTrend(),
      renderCategoryDonut(),
      renderCategoryMargin(),
      renderSubCategory(),
      renderDiscountProfit(),
      renderScatter(),
      renderTopProducts(),
      renderMarginProducts(),
      renderSegments(),
      renderCustomerTiers(),
      renderRegion(),
      renderState(),
      renderShipping(),
      renderInsights(),
    ]);
  } finally {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 450);
  }
}

// ── Sidebar navigation highlight ───────────────────────────
function setupNavHighlight() {
  const sections = document.querySelectorAll('.section');
  const navItems = document.querySelectorAll('.nav-item');

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        navItems.forEach(n => n.classList.remove('active'));
        const match = document.querySelector(`.nav-item[data-section="${en.target.id}"]`);
        if (match) match.classList.add('active');
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(s => io.observe(s));
}

// ── Smooth-scroll nav clicks ────────────────────────────────
function setupNavClicks() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      // close sidebar on mobile
      if (window.innerWidth <= 900) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });
}

// ── Sidebar toggle ─────────────────────────────────────────
function setupMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');

  // Hamburger toggles open/close
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('open');
    } else {
      sidebar.classList.toggle('collapsed');
      // trigger resize for Chart.js to adapt to width change smoothly
      setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    }
  });

  // Clicking anywhere outside sidebar closes it (mobile only)
  document.addEventListener('click', (e) => {
    if (
      window.innerWidth <= 900 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      e.target !== toggle
    ) {
      sidebar.classList.remove('open');
    }
  });
}

// ── Filters ─────────────────────────────────────────────────
function setupFilters() {
  document.getElementById('applyFilters').addEventListener('click', loadAll);
  document.getElementById('resetFilters').addEventListener('click', () => {
    document.getElementById('filterYear').value     = 'all';
    document.getElementById('filterCategory').value = 'all';
    loadAll();
  });
}

// ── Scroll Progress Bar ──────────────────────────────────────
function setupScrollProgress() {
  const bar = document.getElementById('scrollProgress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct  = docH > 0 ? (window.scrollY / docH) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ── Section Reveal ─────────────────────────────────────────
function setupSectionReveal() {
  const sections = document.querySelectorAll('.section');
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.07 });
  sections.forEach(s => io.observe(s));
}

// ── Button Ripple ────────────────────────────────────────────
function setupRipple() {
  document.querySelectorAll('.btn-apply, .btn-reset').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const r    = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height);
      const x    = e.clientX - r.left - size / 2;
      const y    = e.clientY - r.top  - size / 2;
      const wave = document.createElement('span');
      wave.className = 'ripple-wave';
      wave.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
      btn.appendChild(wave);
      wave.addEventListener('animationend', () => wave.remove());
    });
  });
}

// ── 3D Card Tilt ─────────────────────────────────────────────
function setupCardTilt() {
  const tiltEls = document.querySelectorAll('.kpi-card, .insight-card');
  tiltEls.forEach(el => {
    el.addEventListener('mousemove', e => {
      const r  = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
      const dx = (e.clientX - cx) / (r.width  / 2);  // -1 to 1
      const dy = (e.clientY - cy) / (r.height / 2);  // -1 to 1
      const tiltX =  dy * -7;   // max 7° on X axis
      const tiltY =  dx *  7;   // max 7° on Y axis
      el.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

// ── KPI Shimmer Sweep ────────────────────────────────────────
function triggerKpiShimmer() {
  document.querySelectorAll('.kpi-value').forEach(el => {
    el.classList.remove('updating');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('updating');
    el.addEventListener('animationend', () => el.classList.remove('updating'), { once: true });
  });
}

// ── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupScrollProgress();
  setupSectionReveal();
  setupNavHighlight();
  setupNavClicks();
  setupMobileMenu();
  setupFilters();
  setupRipple();
  setTimeout(setupCardTilt, 500); // wait for DOM to be stable
  loadAll().then(() => triggerKpiShimmer());
});

