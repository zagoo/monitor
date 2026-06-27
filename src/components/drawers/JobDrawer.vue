<script setup>
import { computed } from 'vue'
import { Activity, Gauge, Timer, Coins, Radio, AlertTriangle } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { makeSeries } from '../../data/generate.js'
import { stepBreakdown } from '../../data/jobAnalytics.js'
import Drawer from '../common/Drawer.vue'
import LineChart from '../common/LineChart.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

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
      <St :icon="Gauge" label="MFU" :value="j.mfu_pct+'%'" :color="mfuColor(j.mfu_pct)" metric-id="training.mfu.pct" />
      <St :icon="Timer" label="Step p99" :value="j.step_p99_ms+'ms'" color="#8b7bff" metric-id="training.step.time.ms" />
      <St :icon="Coins" label="Goodput" :value="j.goodput_pct+'%'" color="#9cff57" metric-id="cost.goodput.pct" />
    </div>

    <!-- efficiency stats row 2 -->
    <div class="grid grid-cols-4 gap-2">
      <St :icon="Gauge" label="TFLOPS" :value="j.achieved_tflops" color="#37e0a0" metric-id="training.achieved.tflops" />
      <St :icon="Activity" label="通信带宽效率" :value="j.comm_bw_eff_pct+'%'" color="#38e1ff" metric-id="comm.bandwidth.efficiency.pct" />
      <St :icon="Timer" label="空闲占比" :value="j.idle_pct+'%'" color="#ff8a3d" metric-id="accelerator.idle.pct" />
      <St :icon="Activity" label="单卡吞吐" :value="j.per_card_tokens+' t/s'" color="#8b7bff" metric-id="training.throughput.per_card" />
    </div>
    <div class="grid grid-cols-4 gap-2">
      <St :icon="Activity" label="Samples/s" :value="j.samples_per_s" color="#9cff57" metric-id="training.throughput.samples" />
      <St :icon="Gauge" label="SM 占用率" :value="j.sm_occupancy_pct+'%'" color="#ffb648" metric-id="expert.sm.occupancy.pct" />
      <St :icon="Activity" label="预取队列" :value="j.prefetch_q" color="#38e1ff" metric-id="dataloader.prefetch.queue" />
      <St :icon="Activity" label="H2D 拷贝" :value="j.h2d_ms+'ms'" color="#8b7bff" metric-id="dataloader.copy.h2d" />
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

    <!-- training anomalies -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">训练异常</h4>
      <div class="grid grid-cols-4 gap-2">
        <CMini label="NaN/Inf" metric-id="training.nan_inf.events" :value="j.nan_inf_events" :danger="j.nan_inf_events>0" />
        <CMini label="Loss 尖峰" metric-id="training.loss.spike" :value="j.loss_spikes" :danger="j.loss_spikes>2" />
        <CMini label="梯度异常" metric-id="training.gradient.anomaly" :value="j.grad_anomalies" :danger="j.grad_anomalies>0" />
        <CMini label="学习率异常" metric-id="training.lr.anomaly" :value="j.lr_anomalies" :danger="j.lr_anomalies>0" />
      </div>
    </div>

    <!-- checkpoint -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3 flex items-center gap-1">Checkpoint <MetricTooltip metric-id="checkpoint.save.seconds" icon-only dark /></h4>
      <div class="grid grid-cols-5 gap-2">
        <CMini label="保存" metric-id="checkpoint.save.seconds" :value="j.ckpt_save_s+'s'" />
        <CMini label="大小" metric-id="checkpoint.file.size_gb" :value="j.ckpt_size_gb+'GB'" />
        <CMini label="写带宽" metric-id="checkpoint.write.bandwidth" :value="j.ckpt_write_bw" />
        <CMini label="异步队列" metric-id="checkpoint.async.queue_depth" :value="j.ckpt_async_q" />
        <CMini label="失败" metric-id="checkpoint.failures" :value="j.ckpt_failures" :danger="j.ckpt_failures>0" />
      </div>
    </div>

    <!-- expert diagnostics (L2) -->
    <div class="rounded-lg border border-cyber-line bg-cyber-panel-2 p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3 flex items-center gap-1">专家诊断 · L2 <span class="text-[11px] text-cyber-text-3">按需采样</span></h4>
      <div class="grid grid-cols-4 gap-2 mb-3">
        <CMini label="缓存未命中" metric-id="expert.cache.miss" :value="j.cache_miss_pct+'%'" />
        <CMini label="IPC" metric-id="expert.cache.miss" :value="j.ipc" />
        <CMini label="NCCL 算法" metric-id="expert.nccl.debug" :value="j.nccl_algo" />
        <CMini label="TCP 重传" metric-id="expert.ebpf.syscall" :value="j.ebpf_tcp_retx" />
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <CMini label="显存碎片化" metric-id="expert.memory.fragmentation" :value="j.mem_frag_pct+'%'" />
        <CMini label="SM/Warp 占用率" metric-id="expert.sm.occupancy.pct" :value="j.sm_occupancy_pct+'%'" />
      </div>
      <div class="flex items-center gap-1 mb-1.5">
        <span class="micro-label text-cyber-text-3">算子耗时 Top5</span>
        <MetricTooltip metric-id="expert.operator.latency_top" icon-only dark />
      </div>
      <div class="space-y-1">
        <div v-for="op in j.operators_top" :key="op.name" class="flex items-center gap-2 text-[12px]">
          <span class="font-mono text-cyber-text-2 truncate flex-1">{{ op.name }}</span>
          <div class="h-1.5 rounded-full bg-cyber-cyan/70" :style="{ width: (op.ms*8) + 'px' }" />
          <span class="cy-readout text-cyber-text w-12 text-right">{{ op.ms }}ms</span>
        </div>
      </div>
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
import MetricTooltip from '../common/MetricTooltip.vue'
const St = (props) =>
  h('div', { class: 'rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center' }, [
    h(props.icon, { size: 13, class: 'mx-auto mb-1', style: { color: props.color } }),
    h('div', { class: 'cy-readout text-[15px] font-semibold', style: { color: props.color } }, String(props.value)),
    h('div', { class: 'flex items-center justify-center gap-0.5 text-[10px] text-cyber-text-3 uppercase tracking-wide mt-0.5' }, [
      props.label,
      props.metricId ? h(MetricTooltip, { metricId: props.metricId, iconOnly: true, dark: true }) : null
    ])
  ])
St.props = ['icon', 'label', 'value', 'color', 'metricId']
// compact labelled value with tooltip
const CMini = (props) =>
  h('div', { class: 'rounded-md border border-cyber-line bg-cyber-panel p-2 text-center' }, [
    h('div', { class: 'cy-readout text-[14px] font-semibold', style: { color: props.danger ? '#ff5f6d' : '#e6edf6' } }, String(props.value)),
    h('div', { class: 'flex items-center justify-center gap-0.5 text-[10px] text-cyber-text-3 mt-0.5' }, [
      props.label,
      props.metricId ? h(MetricTooltip, { metricId: props.metricId, iconOnly: true, dark: true }) : null
    ])
  ])
CMini.props = ['label', 'value', 'metricId', 'danger']
export default { components: { St, CMini } }
</script>
