<script setup>
import { ref, computed } from 'vue'
import { TrendingUp, BarChart3 } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { METRIC_DICTIONARY, REGIONS, ACCELERATOR_TYPES, TENANTS } from '../../data/catalog.js'
import { makeSeries } from '../../data/generate.js'
import LineChart from '../common/LineChart.vue'
import MetricTooltip from '../common/MetricTooltip.vue'
import SelectMenu from '../common/SelectMenu.vue'

const m = useMonitor()
const metricId = ref('accelerator.utilization.compute.pct')
const groupBy = ref('region')
const aggregation = ref('weighted_avg')
const compare = ref(false)

const GROUPS = [
  { id: 'region', label: '区域' },
  { id: 'model', label: '加速卡型号' },
  { id: 'tenant', label: '租户' }
]
const AGGS = ['weighted_avg', 'avg', 'p95', 'max']
const PALETTE = ['#38e1ff', '#8b7bff', '#9cff57', '#ffb648', '#ff5f6d', '#37e0a0']

const metricOptions = METRIC_DICTIONARY.map((mm) => ({ value: mm.metric_id, label: `${mm.display_name} (${mm.unit})` }))
const groupOptions = GROUPS.map((g) => ({ value: g.id, label: g.label }))
const aggOptions = AGGS.map((a) => ({ value: a, label: a }))

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
      <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">趋势分析</h2>
      <p class="text-[14px] text-steel mt-0.5">跨区域、加速卡型号、租户与时间对比任意指标。</p>
    </header>

    <!-- query builder -->
    <section class="nz-card p-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="指标">
          <SelectMenu v-model="metricId" :options="metricOptions" />
        </Field>
        <Field label="分组">
          <SelectMenu v-model="groupBy" :options="groupOptions" />
        </Field>
        <Field label="聚合">
          <SelectMenu v-model="aggregation" :options="aggOptions" />
        </Field>
        <Field label="基线">
          <button class="w-full h-8 px-2.5 rounded-md border border-hairline-strong bg-canvas flex items-center justify-between text-sm transition-colors hover:border-stone" @click="compare = !compare">
            <span class="whitespace-nowrap" :class="compare ? 'text-ink' : 'text-stone'">对比昨日</span>
            <span class="h-4 w-7 rounded-full relative transition-colors shrink-0" :class="compare ? 'bg-primary' : 'bg-hairline-strong'">
              <span class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all" :class="compare ? 'left-[14px]' : 'left-0.5'" />
            </span>
          </button>
        </Field>
      </div>
      <p class="mt-3 text-[12.5px] text-steel">
        <MetricTooltip :metric-id="metricId" /> · 聚合方式 <span class="font-medium text-charcoal">{{ aggregation }}</span>，
        分组依据 <span class="font-medium text-charcoal">{{ GROUPS.find(g => g.id === groupBy).label }}</span>。
      </p>
    </section>

    <!-- trend chart -->
    <section class="cy-panel p-5">
      <h3 class="text-[15px] font-semibold text-cyber-text mb-1 flex items-center gap-2"><TrendingUp :size="16" class="text-cyber-cyan" />趋势</h3>
      <LineChart :series="compareSeries" :unit="unit" :height="260" :y-min="0" />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- distribution -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-4 flex items-center gap-2"><BarChart3 :size="16" class="text-cyber-violet" />分布</h3>
        <div class="flex items-end gap-1.5 h-40">
          <div v-for="d in dist" :key="d.label" class="flex-1 flex flex-col items-center justify-end gap-1">
            <div class="w-full rounded-t bg-gradient-to-t from-cyber-violet/30 to-cyber-cyan/80" :style="{ height: (d.count / maxDist * 100) + '%' }" />
            <span class="text-[9px] text-cyber-text-3 cy-readout">{{ d.label }}</span>
          </div>
        </div>
      </section>

      <!-- result table -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-3">结果表</h3>
        <table class="w-full">
          <thead>
            <tr class="border-b border-cyber-line text-[11px] uppercase tracking-wide text-cyber-text-3">
              <th class="text-left py-2">分组</th><th class="text-right py-2">均值</th>
              <th class="text-right py-2">P95</th><th class="text-right py-2">最大</th><th class="text-right py-2">Δ</th>
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
