<script setup>
import { ref, computed } from 'vue'
import { TrendingUp, BarChart3 } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { METRIC_DICTIONARY, REGIONS, ACCELERATOR_TYPES, TENANTS } from '../../data/catalog.js'
import { makeSeries } from '../../data/generate.js'
import LineChart from '../common/LineChart.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

const m = useMonitor()
const metricId = ref('accelerator.utilization.compute.pct')
const groupBy = ref('region')
const aggregation = ref('weighted_avg')
const compare = ref(false)

const GROUPS = [
  { id: 'region', label: 'Region' },
  { id: 'model', label: 'Accelerator Model' },
  { id: 'tenant', label: 'Tenant' }
]
const AGGS = ['weighted_avg', 'avg', 'p95', 'max']
const PALETTE = ['#38e1ff', '#8b7bff', '#9cff57', '#ffb648', '#ff5f6d', '#37e0a0']

const groupItems = computed(() => {
  if (groupBy.value === 'region') return REGIONS.map((r) => r.region_name)
  if (groupBy.value === 'model') return ACCELERATOR_TYPES.map((t) => t.label.replace(' Blackwell', '').replace(' PPU', ''))
  return TENANTS.map((t) => t.name)
})

const series = computed(() => {
  const centerBase = metricId.value.includes('temperature') ? 64 : metricId.value.includes('mfu') ? 40 : 58
  return groupItems.value.map((name, i) => ({
    name, color: PALETTE[i % PALETTE.length],
    data: makeSeries(60, centerBase + (i - 1) * 7, 14, i + 1, (i % 2 ? 0.05 : -0.04))
  }))
})
const compareSeries = computed(() => {
  if (!compare.value) return series.value
  const ghost = { name: 'Yesterday (p1)', color: '#5e6b7e', data: makeSeries(60, 52, 10, 99) }
  return [...series.value, ghost]
})

const dist = computed(() => {
  const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
  const r = (k) => Math.abs(Math.sin(k * 1.7) * 40) + 6
  return buckets.map((b, i) => ({ label: `${b}-${b + 10}`, count: Math.round(r(i + groupItems.value.length)) }))
})
const maxDist = computed(() => Math.max(...dist.value.map((d) => d.count)))

const table = computed(() =>
  groupItems.value.map((name, i) => {
    const data = series.value[i].data
    const avg = data.reduce((s, v) => s + v, 0) / data.length
    return {
      name,
      avg: +avg.toFixed(1),
      p95: +(avg * 1.18).toFixed(1),
      max: +Math.max(...data).toFixed(1),
      trend: +(data[data.length - 1] - data[0]).toFixed(1)
    }
  })
)
const unit = computed(() => METRIC_DICTIONARY.find((x) => x.metric_id === metricId.value)?.unit || '')
</script>

<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">Trend Analysis</h2>
      <p class="text-[14px] text-steel mt-0.5">Compare any metric across regions, accelerator models, tenants and time.</p>
    </header>

    <!-- query builder -->
    <section class="nz-card p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Metric">
          <select v-model="metricId" class="nz-input w-full">
            <option v-for="mm in METRIC_DICTIONARY" :key="mm.metric_id" :value="mm.metric_id">{{ mm.display_name }} ({{ mm.unit }})</option>
          </select>
        </Field>
        <Field label="Group By">
          <select v-model="groupBy" class="nz-input w-full">
            <option v-for="g in GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </Field>
        <Field label="Aggregation">
          <select v-model="aggregation" class="nz-input w-full">
            <option v-for="ag in AGGS" :key="ag" :value="ag">{{ ag }}</option>
          </select>
        </Field>
        <Field label="Baseline">
          <button class="nz-input w-full flex items-center justify-between" @click="compare = !compare">
            <span :class="compare ? 'text-ink' : 'text-stone'">Compare to yesterday</span>
            <span class="h-5 w-9 rounded-full relative transition-colors" :class="compare ? 'bg-primary' : 'bg-hairline-strong'">
              <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" :class="compare ? 'left-[18px]' : 'left-0.5'" />
            </span>
          </button>
        </Field>
      </div>
      <p class="mt-3 text-[12.5px] text-steel">
        <MetricTooltip :metric-id="metricId" /> · aggregated by <span class="font-medium text-charcoal">{{ aggregation }}</span>,
        grouped by <span class="font-medium text-charcoal">{{ GROUPS.find(g => g.id === groupBy).label }}</span>.
      </p>
    </section>

    <!-- trend chart -->
    <section class="cy-panel p-5">
      <h3 class="text-[15px] font-semibold text-cyber-text mb-1 flex items-center gap-2"><TrendingUp :size="16" class="text-cyber-cyan" />Trend</h3>
      <LineChart :series="compareSeries" :unit="unit" :height="260" :y-min="0" />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- distribution -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-4 flex items-center gap-2"><BarChart3 :size="16" class="text-cyber-violet" />Distribution</h3>
        <div class="flex items-end gap-1.5 h-40">
          <div v-for="d in dist" :key="d.label" class="flex-1 flex flex-col items-center justify-end gap-1">
            <div class="w-full rounded-t bg-gradient-to-t from-cyber-violet/30 to-cyber-cyan/80" :style="{ height: (d.count / maxDist * 100) + '%' }" />
            <span class="text-[9px] text-cyber-text-3 cy-readout">{{ d.label }}</span>
          </div>
        </div>
      </section>

      <!-- result table -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-3">Result Table</h3>
        <table class="w-full">
          <thead>
            <tr class="border-b border-cyber-line text-[11px] uppercase tracking-wide text-cyber-text-3">
              <th class="text-left py-2">Group</th><th class="text-right py-2">Avg</th>
              <th class="text-right py-2">P95</th><th class="text-right py-2">Max</th><th class="text-right py-2">Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table" :key="row.name" class="border-b border-cyber-line-soft">
              <td class="py-2 text-[13px] text-cyber-text">{{ row.name }}</td>
              <td class="py-2 text-right cy-readout text-[13px] text-cyber-text-2">{{ row.avg }}</td>
              <td class="py-2 text-right cy-readout text-[13px] text-cyber-text-2">{{ row.p95 }}</td>
              <td class="py-2 text-right cy-readout text-[13px] text-cyber-text-2">{{ row.max }}</td>
              <td class="py-2 text-right cy-readout text-[13px]" :class="row.trend >= 0 ? 'text-cyber-green' : 'text-cyber-red'">{{ row.trend >= 0 ? '+' : '' }}{{ row.trend }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script>
import { h } from 'vue'
const Field = (props, { slots }) =>
  h('label', { class: 'block' }, [
    h('span', { class: 'micro-label text-stone block mb-1.5' }, props.label),
    slots.default ? slots.default() : null
  ])
Field.props = ['label']
export default { components: { Field } }
</script>
