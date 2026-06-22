# Compute Resource Monitoring UI

A real-time compute-resource monitoring workspace for a large-model training platform —
cross-Region, multi-accelerator (NVIDIA H200 / RTX PRO 5000 Blackwell / Alibaba Zhenwu PPU).
Built to the uploaded `monitoring_prd_en.md` product spec and `DESIGN.md` Notion visual system.

## Stack

- **Vue 3** with `<script setup>` composition API
- **Tailwind CSS** (design tokens from `DESIGN.md` + a dark-cyber palette)
- **Lucide** icons via `lucide-vue-next`
- **Vite** build, hand-rolled SVG charts (no chart dependency)

## Run

```bash
npm install      # already installed in this folder
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

If `npm run build` ever fails with `EMFILE: too many open files`, raise the
file-descriptor limit first: `ulimit -n 8192`.

## Design language

The UI is a **two-layer** system, exactly as requested:

- **Notion light shell** — white canvas, `#f6f5f4` surfaces, hairline borders, the
  signature purple (`#5645d4`) CTA, Notion-Sans typography, 8px buttons / 12px cards,
  navy (`#0a1530`) hero band. This is the chrome: top bar, left rail, tabs, filters.
- **Dark industrial-cyber metric dashboards** — Slate/Zinc panels (`#11161f`), a faint
  cyan grid, glowing accent edges, monospaced tabular readouts, live pulse indicators,
  animated sparklines. This is every data surface: KPI tiles, matrix, tables, charts, drawers.

## What's implemented (PRD coverage)

| Tab | Highlights |
|-----|-----------|
| **Overview** | Navy hero band + mini-KPI card, 4 dark-cyber KPI tiles, **Region × Accelerator matrix** (click a cell to drill into Resources), TopN (Abnormal / Low-Util / Slow Jobs / Cost), event timeline |
| **Resources** | Inventory summary, sortable + paginated accelerator data grid with live sparklines, status, errors, source health → opens the **Accelerator Detail Drawer** (identity, compute/mem/thermal curves, similar-metric explainer, event timeline, actions) |
| **Jobs** | Job list ranked by wait, selected-job analysis: **step-time breakdown**, KPI stats, **accelerator skew matrix** → **Job Deep-Dive Drawer** (communication, data-loading, loss curves, anomalies) |
| **Trends** | Query builder (metric / group-by / aggregation / baseline compare), multi-series trend chart, distribution, result table |
| **Alerts** | Severity + status filters, rich alert rows (current vs threshold, first/last seen, recurring), acknowledge / silence actions |
| **Cost & Capacity** | Card-hours, waste, Goodput, queue, fragmentation, capacity watermark + card-hours by tenant + watermark trend |
| **Settings** | Metric dictionary with per-metric enable + tooltips, collection profiles (Basic/Standard/Expert), adapter health |

### Cross-cutting features

- **Global filters** (Region / Accelerator / Tenant) + **metric-value presets**
  (allocated-low-util, high-mem-low-compute, thermal throttle, hardware risk) with a
  natural-language match summary (PRD §9.4).
- **Live mode** — the fleet jitters every 4s; toggle Live / Paused in the top bar; manual refresh.
- **Metric tooltips** — hover any P0/P1 metric for definition, difference-from-similar-metrics,
  and default aggregation (PRD §8).
- **Multi-accelerator model** — H200, RTX PRO 5000 Blackwell, Zhenwu 810E/M890 share one
  unified `accelerator` abstraction; PPU-native vs NVIDIA-only fields handled per adapter.

## Project structure

```
src/
├─ App.vue                     # shell: tabs + page switch + drawers
├─ data/
│  ├─ catalog.js               # regions, accelerator types, metric dictionary, tabs
│  ├─ generate.js              # deterministic fleet generator + live jitter + series
│  └─ jobAnalytics.js          # step-time breakdown + accelerator skew matrix
├─ store/useMonitor.js         # reactive store: filters, KPIs, matrix, TopN, cost…
├─ components/
│  ├─ shell/                   # TopBar, LeftRail, FilterBar
│  ├─ common/                  # KpiCard, Sparkline, LineChart, Drawer, StatusBadge, MetricTooltip
│  ├─ pages/                   # Overview, Resources, Jobs, Trends, Alerts, Cost, Settings
│  └─ drawers/                 # AcceleratorDrawer, JobDrawer
```

## Wiring to a real backend

All data flows through `src/store/useMonitor.js`, which is shaped to mirror the PRD API
map (§12.4): `QueryOverviewSummary`, `QueryRegionModelMatrix`, `QueryTopN`,
`QueryResourceInventory`, `GetAcceleratorDetail`, `QueryJobStepBreakdown`,
`QueryJobAcceleratorSkew`, `SearchAlerts`, `QueryCostCapacitySummary`, etc.
Replace the generators in `data/generate.js` with `fetch()` calls to
`/api/v1/monitor/*` and keep the computed selectors as-is.
