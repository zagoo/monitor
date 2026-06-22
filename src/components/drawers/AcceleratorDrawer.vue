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
  if (a.value.offline) e.push({ t: 3, c: '#ff5f6d', m: 'Device went offline' })
  if (a.value.xid_errors) e.push({ t: 12, c: '#ff5f6d', m: `Xid error ×${a.value.xid_errors}` })
  if (a.value.thermal_throttle) e.push({ t: 21, c: '#ffb648', m: `Thermal throttle @ ${a.value.temp_c}°C` })
  e.push({ t: 44, c: '#38e1ff', m: 'Pod scheduled' })
  e.push({ t: 92, c: '#9aa7ba', m: 'Checkpoint saved' })
  return e
})

const ID = computed(() => [
  ['Accelerator ID', a.value.accelerator_id],
  ['UUID', a.value.uuid],
  ['Vendor · Model', `${a.value.vendor === 'nvidia' ? 'NVIDIA' : 'Alibaba PPU'} · ${a.value.model_label}`],
  ['Region · Node', `${a.value.region_name} · ${a.value.node_id}`],
  ['Device Index', a.value.device_index],
  ['Memory', `${a.value.memory_total_gb} GB`],
  ['Power Limit', `${a.value.power_limit_w} W`]
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
      <span class="text-[12px] text-cyber-text-2">Source:</span>
      <span class="text-[12px] font-medium capitalize" :class="a.source_status==='healthy' ? 'text-cyber-green' : 'text-cyber-amber'">{{ a.source_status }}</span>
      <span v-if="a.job_name" class="ml-auto text-[12px] font-mono text-cyber-cyan cursor-pointer hover:underline" @click="m.openDrawer('job', a.job_id)">{{ a.job_name }} →</span>
    </div>

    <!-- live readouts -->
    <div class="grid grid-cols-4 gap-2">
      <Readout :icon="Cpu" label="Compute" :value="a.util_pct + '%'" color="#38e1ff" />
      <Readout :icon="MemoryStick" label="Memory" :value="a.mem_pct + '%'" color="#8b7bff" />
      <Readout :icon="Thermometer" label="Temp" :value="a.temp_c + '°'" color="#ffb648" />
      <Readout :icon="Zap" label="Power" :value="a.power_w + 'W'" color="#9cff57" />
    </div>

    <!-- core curves -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">Compute & Memory · last 4h</h4>
      <LineChart :series="charts" unit="%" :height="170" :y-max="100" />
    </div>
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-2">Thermal & Power</h4>
      <LineChart :series="thermalCharts" :height="150" :y-min="0" />
    </div>

    <!-- identity -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">Identity</h4>
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
        <h4 class="text-[13px] font-semibold text-cyber-text">Compute Util vs MFU vs SM Occupancy</h4>
      </div>
      <p class="text-[12px] leading-snug text-cyber-text-2">
        <span class="text-cyber-text font-medium">Compute utilization</span> shows the card is busy — not that the model is efficient.
        <span class="text-cyber-text font-medium">MFU</span> divides achieved FLOPs by the device peak and is the better efficiency signal.
        <span class="text-cyber-text font-medium">SM occupancy</span> is a kernel-level expert metric, sampled on demand.
      </p>
    </div>

    <!-- event timeline -->
    <div class="cy-panel p-4">
      <h4 class="text-[13px] font-semibold text-cyber-text mb-3">Event Timeline</h4>
      <div class="relative pl-4">
        <span class="absolute left-[5px] top-1 bottom-1 w-px bg-cyber-line" />
        <div v-for="(e, i) in events" :key="i" class="relative flex items-center gap-3 py-1.5">
          <span class="absolute -left-[11px] h-2.5 w-2.5 rounded-full border-2 border-cyber-bg" :style="{ background: e.c }" />
          <span class="cy-readout text-[11px] text-cyber-text-3 w-14">{{ e.t }}m ago</span>
          <span class="text-[12.5px] text-cyber-text-2">{{ e.m }}</span>
        </div>
      </div>
    </div>

    <!-- actions -->
    <div class="grid grid-cols-2 gap-2 pt-1">
      <button class="drw-btn"><Copy :size="14" />Copy ID</button>
      <button class="drw-btn" @click="a.job_id && m.openDrawer('job', a.job_id)"><ExternalLink :size="14" />Open Job</button>
      <button class="drw-btn"><BellPlus :size="14" />Create Alert Rule</button>
      <button class="drw-btn"><Wrench :size="14" />Mark Maintenance</button>
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
