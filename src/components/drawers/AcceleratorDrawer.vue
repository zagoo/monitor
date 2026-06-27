<script setup>
import { computed } from 'vue'
import {
  Copy, ExternalLink, BellPlus, Wrench, Cpu, Thermometer, Zap, MemoryStick, GitCompareArrows
} from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { makeSeries } from '../../data/generate.js'
import Drawer from '../common/Drawer.vue'
import LineChart from '../common/LineChart.vue'
import StatusBadge from '../common/StatusBadge.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

const props = defineProps({ id: { type: String, required: true } })
const emit = defineEmits(['close'])
const m = useMonitor()

const a = computed(() => m.rawState.accelerators.find((x) => x.accelerator_id === props.id))
const seed = computed(() => parseInt(props.id.replace(/\D/g, '') || '1', 10))

const charts = computed(() => {
  const s = seed.value
  return [
    { name: 'Compute %', color: '#38e1ff', data: makeSeries(48, a.value.util_pct, 22, s) },
    { name: 'Memory %', color: '#8b7bff', data: makeSeries(48, a.value.mem_pct, 10, s + 1) }
  ]
})
const thermalCharts = computed(() => {
  const s = seed.value
  return [
    { name: 'Temp °C', color: '#ffb648', data: makeSeries(48, a.value.temp_c, 6, s + 2) },
    { name: 'Power W', color: '#9cff57', data: makeSeries(48, a.value.power_w / 10, 8, s + 3).map((v) => Math.round(v * 10)) }
  ]
})

const events = computed(() => {
  const e = []
  if (a.value.offline) e.push({ t: 3, c: '#ff5f6d', m: '设备离线' })
  if (a.value.xid_errors) e.push({ t: 12, c: '#ff5f6d', m: `Xid 错误 ×${a.value.xid_errors}` })
  if (a.value.thermal_throttle) e.push({ t: 21, c: '#ffb648', m: `热降频 @ ${a.value.temp_c}°C` })
  e.push({ t: 44, c: '#38e1ff', m: 'Pod 已调度' })
  e.push({ t: 92, c: '#9aa7ba', m: 'Checkpoint 已保存' })
  return e
})

const ID = computed(() => [
  ['加速卡 ID', a.value.accelerator_id],
  ['UUID', a.value.uuid],
  ['厂商 · 型号', `${a.value.vendor === 'nvidia' ? 'NVIDIA' : 'Alibaba PPU'} · ${a.value.model_label}`],
  ['区域 · 节点', `${a.value.region_name} · ${a.value.node_id}`],
  ['设备序号', a.value.device_index],
  ['显存', `${a.value.memory_total_gb} GB`],
  ['功率上限', `${a.value.power_limit_w} W`]
])
</script>

<template>
  <Drawer
    v-if="a"
    :title="`${a.node_id} · dev ${a.device_index}`"
    :subtitle="`${a.model_label} · ${a.region_name}`"
    @close="emit('close')"
  >
    <!-- status summary -->
    <div class="flex items-center gap-2 flex-wrap">
      <StatusBadge :status="a.health_status" dark />
      <span class="text-[12px] text-cyber-text-2">采集：</span>
      <span class="text-[12px] font-medium" :class="a.source_status==='healthy' ? 'text-cyber-green' : 'text-cyber-amber'">{{ ({ healthy: '正常', stale: '过期', missing: '缺失' })[a.source_status] || a.source_status }}</span>
      <span v-if="a.job_name" class="ml-auto text-[12px] font-mono text-cyber-cyan cursor-pointer hover:underline" @click="m.openDrawer('job', a.job_id)">{{ a.job_name }} →</span>
    </div>

    <!-- live readouts -->
    <div class="grid grid-cols-4 gap-2">
      <Readout :icon="Cpu" label="计算" :value="a.util_pct + '%'" color="#38e1ff" />
      <Readout :icon="MemoryStick" label="显存" :value="a.mem_pct + '%'" color="#8b7bff" />
      <Readout :icon="Thermometer" label="温度" :value="a.temp_c + '°'" color="#ffb648" />
      <Readout :icon="Zap" label="功耗" :value="a.power_w + 'W'" color="#9cff57" />
    </div>

    <!-- efficiency metrics: SM occupancy · MFU · tensor utilization -->
    <div class="grid grid-cols-3 gap-2">
      <div class="rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center">
        <div class="flex items-center justify-center gap-1 text-[10.5px] text-cyber-text-3">
          SM/Warp 占用率 <MetricTooltip metric-id="expert.sm.occupancy.pct" icon-only dark />
        </div>
        <div class="cy-readout text-[16px] font-semibold mt-1" style="color:#ffb648">{{ a.sm_occupancy_pct }}%</div>
      </div>
      <div class="rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center">
        <div class="flex items-center justify-center gap-1 text-[10.5px] text-cyber-text-3">
          MFU <MetricTooltip metric-id="training.mfu.pct" icon-only dark />
        </div>
        <div class="cy-readout text-[16px] font-semibold mt-1" style="color:#37e0a0">{{ a.mfu_pct }}%</div>
      </div>
      <div class="rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center">
        <div class="flex items-center justify-center gap-1 text-[10.5px] text-cyber-text-3">
          张量/矩阵单元利用率 <MetricTooltip metric-id="accelerator.utilization.tensor.pct" icon-only dark />
        </div>
        <div class="cy-readout text-[16px] font-semibold mt-1" style="color:#8b7bff">{{ a.tensor_pct }}%</div>
      </div>
    </div>

    <!-- core curves -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">计算与显存 · 近 4 小时</h4>
      <LineChart :series="charts" unit="%" :height="170" :y-max="100" />
    </div>
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">温度与功耗</h4>
      <LineChart :series="thermalCharts" :height="150" :y-min="0" />
    </div>

    <!-- identity -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">标识信息</h4>
      <dl class="space-y-1.5">
        <div v-for="row in ID" :key="row[0]" class="flex items-center justify-between text-[12.5px]">
          <dt class="text-cyber-text-3">{{ row[0] }}</dt>
          <dd class="font-mono text-cyber-text-2">{{ row[1] }}</dd>
        </div>
      </dl>
    </div>

    <!-- similar-metric explanation (§11.2.4 item 6) -->
    <div class="rounded-lg border border-cyber-line bg-cyber-panel-2 p-4">
      <div class="flex items-center gap-2 mb-2">
        <GitCompareArrows :size="14" class="text-cyber-cyan" />
        <h4 class="text-[13px] font-semibold text-cyber-text">计算利用率 vs MFU vs SM 占用率</h4>
      </div>
      <p class="text-[12px] leading-snug text-cyber-text-2">
        <span class="text-cyber-text font-medium">计算利用率</span> 表示卡在忙——但不代表模型高效。
        <span class="text-cyber-text font-medium">MFU</span> 用实测 FLOPs 除以设备峰值，是更好的效率信号。
        <span class="text-cyber-text font-medium">SM 占用率</span> 是内核级专家指标，按需采样。
      </p>
    </div>

    <!-- event timeline -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">事件时间线</h4>
      <div class="relative pl-4">
        <span class="absolute left-[5px] top-1 bottom-1 w-px bg-cyber-line" />
        <div v-for="(e, i) in events" :key="i" class="relative flex items-center gap-3 py-1.5">
          <span class="absolute -left-[11px] h-2.5 w-2.5 rounded-full border-2 border-cyber-bg" :style="{ background: e.c }" />
          <span class="cy-readout text-[11px] text-cyber-text-3 w-14">{{ e.t }}分钟前</span>
          <span class="text-[12.5px] text-cyber-text-2">{{ e.m }}</span>
        </div>
      </div>
    </div>

    <!-- actions -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button class="drw-btn"><Copy :size="14" />复制 ID</button>
      <button class="drw-btn" @click="a.job_id && m.openDrawer('job', a.job_id)"><ExternalLink :size="14" />打开作业</button>
      <button class="drw-btn"><BellPlus :size="14" />创建告警规则</button>
      <button class="drw-btn"><Wrench :size="14" />标记维护</button>
    </div>
  </Drawer>
</template>

<script>
import { h } from 'vue'
const Readout = (props) =>
  h('div', { class: 'rounded-lg border border-cyber-line bg-cyber-panel-2 p-2.5 text-center' }, [
    h(props.icon, { size: 14, class: 'mx-auto mb-1', style: { color: props.color } }),
    h('div', { class: 'cy-readout text-[16px] font-semibold', style: { color: props.color } }, props.value),
    h('div', { class: 'text-[10.5px] text-cyber-text-3 uppercase tracking-wide mt-0.5' }, props.label)
  ])
Readout.props = ['icon', 'label', 'value', 'color']
export default { components: { Readout } }
</script>

<style scoped>
.drw-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  height: 38px; border-radius: 8px;
  border: 1px solid #232b39; background: #161c27;
  color: #9aa7ba; font-size: 13px; font-weight: 500;
  transition: all 0.12s;
}
.drw-btn:hover { background: #1b222e; color: #e6edf6; border-color: #38e1ff66; }
</style>
