const form = document.getElementById('calculator-form');
const modelSelect = document.getElementById('business-model');
const sellSection = document.getElementById('sell-section');
const rentalSection = document.getElementById('rental-section');
const resultsSection = document.getElementById('results');
const summaryContainer = document.getElementById('result-summary');
const analysisBody = document.getElementById('analysis-body');
const saveScenarioButton = document.getElementById('save-scenario');
const exportCsvButton = document.getElementById('export-csv');
const clearBoardButton = document.getElementById('clear-board');

const STORAGE_KEY = 'ict-costing-analysis-board-v2';
let lastResult = null;
let board = loadBoard();

const asNumber = (value) => Number.parseFloat(value) || 0;
const pct = (value) => asNumber(value) / 100;
const myr = (value) =>
  new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(value);
const percent = (value) => `${(value * 100).toFixed(2)}%`;

function toggleModelSections() {
  const isSell = modelSelect.value === 'sell';
  sellSection.classList.toggle('hidden', !isSell);
  rentalSection.classList.toggle('hidden', isSell);
}

function baseCosting(data) {
  const directCost = asNumber(data.unitCost) + asNumber(data.logisticsCost);
  const overheadCost = directCost * pct(data.overhead);
  const totalCostPerUnit = directCost + overheadCost;
  const totalCost = totalCostPerUnit * Math.max(1, asNumber(data.quantity));

  return { directCost, overheadCost, totalCostPerUnit, totalCost };
}

function calculateSell(data) {
  const base = baseCosting(data);
  const quantity = Math.max(1, asNumber(data.quantity));
  const targetMargin = pct(data.sellMargin);
  const discount = pct(data.discount);
  const commissionRate = pct(data.commissionRate);
  const winProbability = pct(data.winProbability);
  const sstRate = pct(data.sst);

  const listPricePerUnit = targetMargin >= 0.95 ? 0 : base.totalCostPerUnit / (1 - targetMargin);
  const netPricePerUnit = listPricePerUnit * (1 - discount);
  const revenueExSst = netPricePerUnit * quantity;
  const sstAmount = revenueExSst * sstRate;
  const invoiceValue = revenueExSst + sstAmount;
  const commission = revenueExSst * commissionRate;

  const grossProfit = revenueExSst - base.totalCost - commission;
  const margin = revenueExSst > 0 ? grossProfit / revenueExSst : 0;
  const riskAdjustedProfit = grossProfit * winProbability;

  return {
    mode: 'Sell',
    scenarioName: data.scenarioName,
    itemName: data.itemName,
    quantity,
    ...base,
    targetMargin,
    discount,
    listPricePerUnit,
    netPricePerUnit,
    revenueExSst,
    sstAmount,
    invoiceValue,
    commission,
    grossProfit,
    margin,
    riskAdjustedProfit,
  };
}

function calculateRental(data) {
  const base = baseCosting(data);
  const quantity = Math.max(1, asNumber(data.quantity));
  const term = Math.max(1, asNumber(data.term));
  const residualPerUnit = Math.min(asNumber(data.residual), base.totalCostPerUnit);
  const utilization = Math.max(0.01, pct(data.utilization));
  const financeRate = pct(data.financeRate);
  const maintenanceRate = pct(data.maintenanceRate);
  const targetMargin = pct(data.rentalMargin);
  const sstRate = pct(data.sst);
  const deployment = asNumber(data.deployment);
  const slaPenaltyFactor = Math.max(0, (99.9 - asNumber(data.sla)) / 100);

  const depreciationPerUnit = (base.totalCostPerUnit - residualPerUnit) / term;
  const financePerUnit = (base.totalCostPerUnit * financeRate) / 12;
  const maintenancePerUnit = (base.totalCostPerUnit * maintenanceRate) / 12;

  const monthlyCostPerUnitAt100 = depreciationPerUnit + financePerUnit + maintenancePerUnit;
  const monthlyCostPerUnit = monthlyCostPerUnitAt100 / utilization;
  const recommendedMonthlyRatePerUnit = targetMargin >= 0.95 ? 0 : monthlyCostPerUnit / (1 - targetMargin);

  const monthlyRevenueExSst = recommendedMonthlyRatePerUnit * quantity;
  const monthlySst = monthlyRevenueExSst * sstRate;
  const monthlyInvoice = monthlyRevenueExSst + monthlySst;
  const monthlyCost = monthlyCostPerUnit * quantity + deployment / term;
  const monthlyGrossProfit = monthlyRevenueExSst - monthlyCost;
  const monthlyMargin = monthlyRevenueExSst > 0 ? monthlyGrossProfit / monthlyRevenueExSst : 0;
  const riskAdjustedProfit = monthlyGrossProfit * (1 - slaPenaltyFactor);

  return {
    mode: 'Rental',
    scenarioName: data.scenarioName,
    itemName: data.itemName,
    quantity,
    ...base,
    term,
    targetMargin,
    monthlyCostPerUnit,
    recommendedMonthlyRatePerUnit,
    monthlyRevenueExSst,
    monthlySst,
    monthlyInvoice,
    monthlyCost,
    monthlyGrossProfit,
    monthlyMargin,
    annualRevenue: monthlyRevenueExSst * 12,
    annualGrossProfit: monthlyGrossProfit * 12,
    riskAdjustedProfit,
  };
}

function renderMetric(label, value) {
  return `<article class="metric"><h3>${label}</h3><strong>${value}</strong></article>`;
}

function renderSell(result) {
  summaryContainer.innerHTML = [
    renderMetric('Scenario', result.scenarioName),
    renderMetric('Item / Qty', `${result.itemName} / ${result.quantity}`),
    renderMetric('Total Cost', myr(result.totalCost)),
    renderMetric('Revenue (Ex SST)', myr(result.revenueExSst)),
    renderMetric('Invoice (Incl SST)', myr(result.invoiceValue)),
    renderMetric('Gross Profit', myr(result.grossProfit)),
    renderMetric('Gross Margin', percent(result.margin)),
    renderMetric('Risk-adjusted Profit', myr(result.riskAdjustedProfit)),
  ].join('');
}

function renderRental(result) {
  summaryContainer.innerHTML = [
    renderMetric('Scenario', result.scenarioName),
    renderMetric('Item / Qty', `${result.itemName} / ${result.quantity}`),
    renderMetric('Monthly Cost', myr(result.monthlyCost)),
    renderMetric('Monthly Revenue (Ex SST)', myr(result.monthlyRevenueExSst)),
    renderMetric('Monthly Invoice (Incl SST)', myr(result.monthlyInvoice)),
    renderMetric('Monthly Gross Profit', myr(result.monthlyGrossProfit)),
    renderMetric('Monthly Margin', percent(result.monthlyMargin)),
    renderMetric('Annual Gross Profit', myr(result.annualGrossProfit)),
  ].join('');
}

function saveBoard() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
}

function loadBoard() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderBoard() {
  if (board.length === 0) {
    analysisBody.innerHTML = '<tr><td colspan="9" class="muted">No scenarios saved yet.</td></tr>';
    return;
  }

  analysisBody.innerHTML = board
    .map(
      (row) => `<tr>
        <td>${row.scenarioName}</td>
        <td>${row.mode}</td>
        <td>${row.itemName}</td>
        <td>${row.quantity}</td>
        <td>${myr(row.revenue)}</td>
        <td>${myr(row.cost)}</td>
        <td>${myr(row.grossProfit)}</td>
        <td>${percent(row.margin)}</td>
        <td>${myr(row.riskAdjustedProfit)}</td>
      </tr>`,
    )
    .join('');
}

function normalizeBoardRow(result) {
  if (result.mode === 'Sell') {
    return {
      scenarioName: result.scenarioName,
      mode: result.mode,
      itemName: result.itemName,
      quantity: result.quantity,
      revenue: result.revenueExSst,
      cost: result.totalCost,
      grossProfit: result.grossProfit,
      margin: result.margin,
      riskAdjustedProfit: result.riskAdjustedProfit,
    };
  }

  return {
    scenarioName: result.scenarioName,
    mode: result.mode,
    itemName: result.itemName,
    quantity: result.quantity,
    revenue: result.monthlyRevenueExSst,
    cost: result.monthlyCost,
    grossProfit: result.monthlyGrossProfit,
    margin: result.monthlyMargin,
    riskAdjustedProfit: result.riskAdjustedProfit,
  };
}

function exportBoardToCsv() {
  if (board.length === 0) {
    alert('No analysis data to export yet. Save a scenario first.');
    return;
  }

  const headers = ['Scenario', 'Model', 'Item', 'Quantity', 'Revenue', 'Total Cost', 'Gross Profit', 'Margin', 'RiskAdjustedProfit'];
  const rows = board.map((row) => [
    row.scenarioName,
    row.mode,
    row.itemName,
    row.quantity,
    row.revenue.toFixed(2),
    row.cost.toFixed(2),
    row.grossProfit.toFixed(2),
    (row.margin * 100).toFixed(2),
    row.riskAdjustedProfit.toFixed(2),
  ]);

  const csv = [headers, ...rows].map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ict-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

modelSelect.addEventListener('change', toggleModelSections);

toggleModelSections();
renderBoard();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  lastResult = data.businessModel === 'sell' ? calculateSell(data) : calculateRental(data);

  if (data.businessModel === 'sell') {
    renderSell(lastResult);
  } else {
    renderRental(lastResult);
  }

  resultsSection.classList.remove('hidden');
});

saveScenarioButton.addEventListener('click', () => {
  if (!lastResult) {
    alert('Calculate a scenario first before saving to the analysis board.');
    return;
  }

  board.unshift(normalizeBoardRow(lastResult));
  board = board.slice(0, 100);
  saveBoard();
  renderBoard();
});

exportCsvButton.addEventListener('click', exportBoardToCsv);

clearBoardButton.addEventListener('click', () => {
  board = [];
  saveBoard();
  renderBoard();
});
