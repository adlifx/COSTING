# Malaysia ICT Costing & Margin Analysis Suite

Professional web app for daily ICT pricing decisions in Malaysia.

## What it supports
- Sell model analysis (margin, discount impact, commission, win-probability risk adjustment)
- Rental model analysis (depreciation, finance/maintenance, utilization-adjusted rate, SLA effect)
- Malaysian currency formatting (MYR) and SST input
- Scenario board to save and compare cases
- CSV export for reporting and deeper analysis in Excel/BI tools

## Run locally
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/index.html`.


## Where data is stored
- Calculations are generated in-page (not automatically persisted).
- Data is saved only when you click **Save to Analysis Board**.
- Saved scenarios are stored in your browser `localStorage` under key `ict-costing-analysis-board-v2` (device/browser specific).
- Use **Export CSV** to keep an external backup or share analysis.
