<script setup>
import { computed } from 'vue'
import { Clock, TrendingDown, Gauge, ListOrdered, Boxes, Activity } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { TENANTS } from '../../data/catalog.js'
import LineChart from '../common/LineChart.vue'
import { makeSeries } from '../../data/generate.js'

const m = useMonitor()
const { costSummary, filteredJobs } = m

const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : `${Math.round(n)}`

const byTenant = computed(() => {
  const map = {}
  for (const t of TENANTS) map[t.tenant_id] = { name: t.name, hours: 0, cost: 0, waste: 0 }
  for (const j of filteredJobs.value) {
    const b = map[j.tenant_id]; if (!b) continue
    b.hours += j.card_hours
    b.cost += j.card_hours * 2.2
    b.waste += j.mfu_pct < 30 ? j.card_hours * 0.4 : j.card_hours * 0.08
  }
  const arr = Object.values(map).sort((a, b) => b.hours - a.hours)
  const max = Math.max(...arr.map((x) => x.hours), 1)
  return arr.map((x) => ({ ...x, pct: (x.hours / max) * 100 }))
})

const watermark = computed(() => [{ name: 'Allocation %', color: '#38e1ff', data: makeSeries(60, 78, 10, 7).map((v) => Math.round(v)) }])
const goodColor = computed(() => costSummary.value.goodput >= 80 ? '#37e0a0' : costSummary.value.goodput >= 65 ? '#ffb648' : '#ff5f6d')
</script>

<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">Cost & Capacity</h2>
      <p class="text-[14px] text-steel mt-0.5">Card-hours, idle waste, Goodput, queues and capacity watermark.</p>
    </header>

    <!-- core cards -->
    <section class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card :icon="Clock" title="Card-Hours" :value="fmt(costSummary.card_hours)" accent="#38e1ff"
        :rows="[['Allocated', fmt(costSummary.allocated_hours)], ['Active', fmt(costSummary.active_hours)]]" />
      <Card :icon="TrendingDown" title="Waste" :value="'$' + fmt(costSummary.waste_cost)" accent="#ff5f6d"
        :rows="[['Idle card-h', fmt(costSummary.idle_hours)], ['Low-util card-h', fmt(costSummary.low_util_hours)]]" />
      <Card :icon="Gauge" title="Goodput" :value="costSummary.goodput + '%'" :accent="goodColor"
        :rows="[['Effective training', 'ratio'], ['Target', '≥ 80%']]" />
      <Card :icon="ListOrdered" title="Queue" :value="costSummary.queue_p95 + 'm'" accent="#ffb648"
        :rows="[['P50 wait', costSummary.queue_p50 + 'm'], ['Queue depth', costSummary.queue_depth]]" />
      <Card :icon="Boxes" title="Fragmentation" :value="costSummary.fragmentation_pct + '%'" accent="#8b7bff"
        :rows="[['Unschedulable', 'remaining'], ['By topology', 'gray-zone']]" />
      <Card :icon="Activity" title="Capacity Watermark" :value="costSummary.watermark_pct + '%'" accent="#9cff57"
        :rows="[['7d peak', '91%'], ['Forecast 30d', '+6%']]" />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- cost by tenant -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-4">Card-Hours by Tenant</h3>
        <div class="space-y-3">
          <div v-for="t in byTenant" :key="t.name">
            <div class="flex items-center justify-between text-[12.5px] mb-1">
              <span class="text-cyber-text">{{ t.name }}</span>
              <span class="cy-readout text-cyber-text-2">{{ fmt(t.hours) }} card-h · <span class="text-cyber-amber">${{ fmt(t.cost) }}</span></span>
            </div>
            <div class="h-2.5 rounded-full bg-cyber-line overflow-hidden relative">
              <div class="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-violet" :style="{ width: t.pct + '%' }" />
            </div>
          </div>
        </div>
      </section>

      <!-- watermark trend -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-2">Allocation Watermark · 7d</h3>
        <LineChart :series="watermark" unit="%" :height="200" :y-max="100" :y-min="0" />
      </section>
    </div>
  </div>
</template>

<script>
import { h } from 'vue'
const Card = (props) =>
  h('div', { class: 'cy-panel p-5' }, [
    h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'micro-label text-cyber-text-3' }, props.title),
      props.icon ? h(props.icon, { size: 15, style: { color: props.accent } }) : null
    ]),
    h('div', { class: 'mt-2 cy-readout text-[26px] font-semibold', style: { color: props.accent } }, String(props.value)),
    h('div', { class: 'mt-3 space-y-1 border-t border-cyber-line pt-2.5' },
      (props.rows || []).map((r) =>
        h('div', { class: 'flex items-center justify-between text-[12px]' }, [
          h('span', { class: 'text-cyber-text-3' }, r[0]),
          h('span', { class: 'cy-readout text-cyber-text-2' }, String(r[1]))
        ])
      )
    )
  ])
Card.props = ['icon', 'title', 'value', 'accent', 'rows']
export default { components: { Card } }
</script>
