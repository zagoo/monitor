<script setup>
import { computed } from 'vue'
import { Clock, TrendingDown, Gauge, ListOrdered, Boxes, Activity, Wallet, Shuffle } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import LineChart from '../common/LineChart.vue'
import { makeSeries } from '../../data/generate.js'

const m = useMonitor()
const { costSummary, tenantCost } = m

const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : `${Math.round(n)}`

const byTenant = computed(() => {
  const arr = tenantCost.value
  const max = Math.max(...arr.map((x) => x.hours), 1)
  return arr.map((x) => ({ ...x, pct: (x.hours / max) * 100 }))
})

const watermark = computed(() => [{ name: 'Allocation %', color: '#38e1ff', data: makeSeries(60, 78, 10, 7).map((v) => Math.round(v)) }])
const goodColor = computed(() => costSummary.value.goodput >= 80 ? '#37e0a0' : costSummary.value.goodput >= 65 ? '#ffb648' : '#ff5f6d')
</script>

<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">成本与容量</h2>
      <p class="text-[14px] text-steel mt-0.5">卡时、空闲浪费、Goodput、排队与容量水位。</p>
    </header>

    <!-- core cards -->
    <section class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card :icon="Clock" title="卡时" :value="fmt(costSummary.card_hours)" accent="#38e1ff" metric-id="cost.card_hours"
        :rows="[['已分配', fmt(costSummary.allocated_hours)], ['活跃', fmt(costSummary.active_hours)]]" />
      <Card :icon="TrendingDown" title="浪费" :value="'$' + fmt(costSummary.waste_cost)" accent="#ff5f6d" metric-id="cost.idle_card_hours"
        :rows="[['空闲卡时', fmt(costSummary.idle_hours)], ['低利用卡时', fmt(costSummary.low_util_hours)]]" />
      <Card :icon="Gauge" title="Goodput" :value="costSummary.goodput + '%'" :accent="goodColor" metric-id="cost.goodput.pct"
        :rows="[['有效训练', '占比'], ['目标', '≥ 80%']]" />
      <Card :icon="ListOrdered" title="排队" :value="costSummary.queue_p95 + 'm'" accent="#ffb648" metric-id="sched.queue.time"
        :rows="[['P50 等待', costSummary.queue_p50 + 'm'], ['队列深度', costSummary.queue_depth]]" />
      <Card :icon="Boxes" title="碎片化" :value="costSummary.fragmentation_pct + '%'" accent="#8b7bff" metric-id="sched.fragmentation.pct"
        :rows="[['不可调度', '剩余'], ['按拓扑', '灰区']]" />
      <Card :icon="Activity" title="容量水位" :value="costSummary.watermark_pct + '%'" accent="#9cff57" metric-id="fleet.cards.allocated"
        :rows="[['7 天峰值', '91%'], ['30 天预测', '+6%']]" />
      <Card :icon="Wallet" title="预算消耗率" :value="costSummary.budget_used_pct + '%'" accent="#ff64c8" metric-id="cost.budget.burn"
        :rows="[['本月', costSummary.budget_used_pct + '%'], ['告警阈值', '≥ 90%']]" />
      <Card :icon="Shuffle" title="抢占次数" :value="costSummary.preemptions" accent="#ffb648" metric-id="sched.preemption.events"
        :rows="[['近 24h', costSummary.preemptions], ['影响', 'Goodput']]" />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- cost by tenant -->
      <section class="cy-panel p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-[15px] font-semibold text-cyber-text">各租户卡时</h3>
          <span class="flex items-center gap-3 text-[11px] text-cyber-text-3">
            <span class="flex items-center gap-1">配额使用率 <MetricTooltip metric-id="sched.quota.utilization" icon-only dark /></span>
            <span class="flex items-center gap-1">预算 <MetricTooltip metric-id="cost.budget.burn" icon-only dark /></span>
          </span>
        </div>
        <div class="space-y-3.5">
          <div v-for="t in byTenant" :key="t.name">
            <div class="flex items-center justify-between text-[12.5px] mb-1">
              <span class="text-cyber-text">{{ t.name }}</span>
              <span class="cy-readout text-cyber-text-2">{{ fmt(t.hours) }} card-h · <span class="text-cyber-amber">${{ fmt(t.cost) }}</span></span>
            </div>
            <div class="h-2.5 rounded-full bg-cyber-line overflow-hidden relative">
              <div class="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-violet" :style="{ width: t.pct + '%' }" />
            </div>
            <div class="flex items-center gap-3 mt-1 text-[11px] cy-readout">
              <span class="text-cyber-text-3">配额 <span :style="{ color: t.quota_pct >= 90 ? '#ff5f6d' : '#9aa7ba' }">{{ t.quota_pct }}%</span> ({{ t.cards }}/{{ t.quota_cards }})</span>
              <span class="text-cyber-text-3">预算 <span :style="{ color: t.budget_pct >= 80 ? '#ffb648' : '#9aa7ba' }">{{ t.budget_pct }}%</span></span>
            </div>
          </div>
        </div>
      </section>

      <!-- watermark trend -->
      <section class="cy-panel p-5">
        <h3 class="text-[15px] font-semibold text-cyber-text mb-2">分配水位 · 近 7 天</h3>
        <LineChart :series="watermark" unit="%" :height="200" :y-max="100" :y-min="0" />
      </section>
    </div>
  </div>
</template>

<script>
import { h } from 'vue'
import MetricTooltip from '../common/MetricTooltip.vue'
const Card = (props) =>
  h('div', { class: 'cy-panel p-5' }, [
    h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'flex items-center gap-1' }, [
        h('span', { class: 'micro-label text-cyber-text-3' }, props.title),
        props.metricId ? h(MetricTooltip, { metricId: props.metricId, iconOnly: true, dark: true }) : null
      ]),
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
Card.props = ['icon', 'title', 'value', 'accent', 'rows', 'metricId']
export default { components: { Card, MetricTooltip } }
</script>
