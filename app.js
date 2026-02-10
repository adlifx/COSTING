const form = document.getElementById('calculator-form');
const modelSelect = document.getElementById('business-model');
const sellSection = document.getElementById('sell-section');
const rentalSection = document.getElementById('rental-section');
const resultsSection = document.getElementById('results');
const summaryContainer = document.getElementById('result-summary');

const asNumber = (value) => Number.parseFloat(value) || 0;
const pct = (value) => asNumber(value) / 100;
const usd = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const percent = (value) => `${(value * 100).toFixed(2)}%`;

function toggleModelSections() {
  const isSell = modelSelect.value === 'sell';
  sellSection.classList.toggle('hidden', !isSell);
  rentalSection.classList.toggle('hidden', isSell);
}

function baseCosting(data) {
  const directCost = asNumber(data.unitCost) + asNumber(data.logisticsCost);
  const overheadCost = directCost * pct(data.overhead);
  const totalCost = directCost + overheadCost;

  return { directCost, overheadCost, totalCost };
}

function calculateSell(data) {
  const base = baseCosting(data);
  const targetMargin = pct(data.sellMargin);
  const discount = pct(data.discount);

  const listPrice = targetMargin >= 0.95 ? 0 : base.totalCost / (1 - targetMargin);
  const netSellPrice = listPrice * (1 - discount);
  const actualMargin = netSellPrice > 0 ? (netSellPrice - base.totalCost) / netSellPrice : 0;

  return {
    mode: 'Sell',
    ...base,
    listPrice,
    netSellPrice,
    targetMargin,
    actualMargin,
    discount,
  };
}

function calculateRental(data) {
  const base = baseCosting(data);
  const term = Math.max(1, asNumber(data.term));
  const residual = Math.min(asNumber(data.residual), base.totalCost);
  const utilization = Math.max(0.01, pct(data.utilization));
  const financeRate = pct(data.financeRate);
  const maintenanceRate = pct(data.maintenanceRate);
  const targetMargin = pct(data.rentalMargin);

  const monthlyDepreciation = (base.totalCost - residual) / term;
  const monthlyFinance = (base.totalCost * financeRate) / 12;
  const monthlyMaintenance = (base.totalCost * maintenanceRate) / 12;
  const monthlyCostAtFullUse = monthlyDepreciation + monthlyFinance + monthlyMaintenance;

  const monthlyCost = monthlyCostAtFullUse / utilization;
  const recommendedMonthlyRate = targetMargin >= 0.95 ? 0 : monthlyCost / (1 - targetMargin);
  const actualMargin = recommendedMonthlyRate > 0 ? (recommendedMonthlyRate - monthlyCost) / recommendedMonthlyRate : 0;

  return {
    mode: 'Rental',
    ...base,
    monthlyDepreciation,
    monthlyFinance,
    monthlyMaintenance,
    monthlyCost,
    recommendedMonthlyRate,
    actualMargin,
    targetMargin,
    annualRevenuePerUnit: recommendedMonthlyRate * 12,
  };
}

function renderMetric(label, value) {
  return `
    <article class="metric">
      <h3>${label}</h3>
      <strong>${value}</strong>
    </article>
  `;
}

function renderSell(result, itemName) {
  summaryContainer.innerHTML = `
    <p><strong>${itemName}</strong> • ${result.mode} model</p>
    <div class="result-grid">
      ${renderMetric('Direct Cost', usd(result.directCost))}
      ${renderMetric('Overhead Cost', usd(result.overheadCost))}
      ${renderMetric('Total Cost', usd(result.totalCost))}
      ${renderMetric('List Price', usd(result.listPrice))}
      ${renderMetric('Net Sell Price', usd(result.netSellPrice))}
      ${renderMetric('Target Margin', percent(result.targetMargin))}
      ${renderMetric('Actual Margin (after discount)', percent(result.actualMargin))}
    </div>
  `;
}

function renderRental(result, itemName) {
  summaryContainer.innerHTML = `
    <p><strong>${itemName}</strong> • ${result.mode} model</p>
    <div class="result-grid">
      ${renderMetric('Direct Cost', usd(result.directCost))}
      ${renderMetric('Overhead Cost', usd(result.overheadCost))}
      ${renderMetric('Total Cost', usd(result.totalCost))}
      ${renderMetric('Monthly Cost (utilization-adjusted)', usd(result.monthlyCost))}
      ${renderMetric('Recommended Monthly Rate', usd(result.recommendedMonthlyRate))}
      ${renderMetric('Annual Revenue per Unit', usd(result.annualRevenuePerUnit))}
      ${renderMetric('Target Margin', percent(result.targetMargin))}
      ${renderMetric('Actual Margin', percent(result.actualMargin))}
    </div>
  `;
}

modelSelect.addEventListener('change', toggleModelSections);

toggleModelSections();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  const itemName = data.itemName?.trim() || 'ICT Item';

  const result = data.businessModel === 'sell' ? calculateSell(data) : calculateRental(data);

  if (data.businessModel === 'sell') {
    renderSell(result, itemName);
  } else {
    renderRental(result, itemName);
  }

  resultsSection.classList.remove('hidden');
});
