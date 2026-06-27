<script setup>
import { computed } from 'vue'
import { Activity, Gauge, Timer, Coins, Radio, AlertTriangle } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { makeSeries } from '../../data/generate.js'
import { stepBreakdown } from '../../data/jobAnalytics.js'
import Drawer from '../common/Drawer.vue'
import LineChart from '../common/LineChart.vue'

const props = defineProps({ id: { type: String, required: true } })
const emit = defineEmits(['close'])
const m = useMonitor()

const j = computed(() => m.rawState.jobs.find((x) => x.job_id === props.id))
const seed = computed(() => parseInt(props.id.replace(/\D/g, '') || '1', 10))
const breakdown = computed(() => j.value ? stepBreakdown(j.value) : [])

const commCharts = computed(() => [
  { name: 'AllReduce ms', color: '#ff5f6d', data: makeSeries(40, 18, 12, seed.value) },
  { name: 'AllGather ms', color: '#ffb648', data: makeSeries(40, 11, 8, seed.value + 1) }
])
const ioCharts = computed(() => [
  { name: 'DataLoader ms', color: '#38e1ff', data: makeSeries(40, j.value.data_wait_pct * 3, 14, seed.value + 2) }
])
const lossCharts = computed(() => {
  const base = makeSeries(60, 50, 4, seed.value + 3).map((v, i) => +(2.6 - i * 0.02 + (v - 50) * 0.01).toFixed(3))
  return [{ name: 'Loss', color: '#9cff57', data: base }]
})
const anomalies = computed(() => {
  const e = []
  if (j.value.comm_wait_pct > 30) e.push({ t: 8, c: '#ff5f6d', m: `通信等待 ${j.value.comm_wait_pct}% —— NCCL 处于关键路径` })
  if (j.value.data_wait_pct > 25) e.push({ t: 19, c: '#ffb648', m: `DataLoader 阻塞 ${j.value.data_wait_pct}%` })
  e.push({ t: 34, c: '#9cff57', m: 'Checkpoint 已保存（4.2 GB，12s）' })
  e.push({ t: 70, c: '#38e1ff', m: 'Pod 已重新调度至 node07' })
  return e
})
function mfuColor(v) { return v >= 45 ? '#37e0a0' : v >= 30 ? '#38e1ff' : '#ffb648' }
</script>

<template>
  <Drawer v-if="j" :title="j.job_name" :subtitle="`${j.framework} · ${j.parallel_strategy} · ${j.tenant_name}`" @close="emit('close')">
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 text-[12px] font-medium" :class="j.status==='running' ? 'text-cyber-green' : 'text-cyber-amber'">
        <Radio :size="13" /> {{ ({ running: '运行中', queued: '排队中', completed: '已完成' })[j.status] || j.status }}
      </span>
      <span class="text-[12px] text-cyber-text-2">· {{ j.cards }} 卡 · 已运行 {{ Math.round(j.started_min_ago/60) }} 小时</span>
    </div>

    <div class="grid grid-cols-4 gap-2">
      <St :icon="Activity" label="tok/s" :value="(j.tokens_per_s/1000).toFixed(1)+'k'" color="#38e1ff" />
      <St :icon="Gauge" label="MFU" :value="j.mfu_pct+'%'" :color="mfuColor(j.mfu_pct)" />
      <St :icon="Timer" label="Step p99" :value="j.step_p99_ms+'ms'" color="#8b7bff" />
      <St :icon="Coins" label="Goodput" :value="j.goodput_pct+'%'" color="#9cff57" />
    </div>

    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">Step 耗时分解</h4>
      <div class="flex h-6 w-full rounded-md overflow-hidden border border-cyber-line">
        <div v-for="b in breakdown" :key="b.name" :style="{ width: b.pct + '%', background: b.color }" :title="`${b.name} ${b.pct}%`" />
      </div>
      <div class="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-3">
        <div v-for="b in breakdown" :key="b.name" class="flex items-center gap-1.5 text-[12px]">
          <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: b.color }" />
          <span class="text-cyber-text-2">{{ b.name }}</span>
          <span class="cy-readout text-cyber-text ml-auto">{{ b.pct }}%</span>
        </div>
      </div>
    </div>

    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">集合通信</h4>
      <LineChart :series="commCharts" unit="ms" :height="140" :y-min="0" />
    </div>
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">数据加载</h4>
      <LineChart :series="ioCharts" unit="ms" :height="120" :y-min="0" />
    </div>
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">Loss 曲线</h4>
      <LineChart :series="lossCharts" :height="130" :y-min="0" :y-max="3" />
    </div>

    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3 flex items-center gap-2"><AlertTriangle :size="14" class="text-cyber-amber" />作业事件与异常</h4>
      <div class="relative pl-4">
        <span class="absolute left-[5px] top-1 bottom-1 w-px bg-cyber-line" />
        <div v-for="(e, i) in anomalies" :key="i" class="relative flex items-start gap-3 py-1.5">
          <span class="absolute -left-[11px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-cyber-bg" :style="{ background: e.c }" />
          <span class="cy-readout text-[11px] text-cyber-text-3 w-14 shrink-0">{{ e.t }}分钟前</span>
          <span class="text-[12.5px] text-cyber-text-2">{{ e.m }}</span>
        </div>
      </div>
    </div>
  </Drawer>
</template>

<script>
import { h } from 'vue'
const St = (props) =>
  h('div', { class: 'rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center' }, [
    h(props.icon, { size: 13, class: 'mx-auto mb-1', style: { color: props.color } }),
    h('div', { class: 'cy-readout text-[15px] font-semibold', style: { color: props.color } }, props.value),
    h('div', { class: 'text-[10px] text-cyber-text-3 uppercase tracking-wide mt-0.5' }, props.label)
  ])
St.props = ['icon', 'label', 'value', 'color']
export default { components: { St } }
</script>
