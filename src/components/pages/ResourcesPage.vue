<script setup>
import { ref, computed } from 'vue'
import { Server, Cpu, Zap, AlertTriangle, ArrowUpDown, ChevronRight } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import FilterBar from '../shell/FilterBar.vue'
import StatusBadge from '../common/StatusBadge.vue'
import Sparkline from '../common/Sparkline.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

const m = useMonitor()
const { filteredAccelerators } = m

const sortKey = ref('util_pct')
const sortDir = ref('asc')
const page = ref(1)
const pageSize = 14

function setSort(k) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = k; sortDir.value = 'desc' }
  page.value = 1
}

const sorted = computed(() => {
  const arr = [...filteredAccelerators.value]
  arr.sort((a, b) => {
    const x = a[sortKey.value], y = b[sortKey.value]
    const r = typeof x === 'string' ? x.localeCompare(y) : x - y
    return sortDir.value === 'asc' ? r : -r
  })
  return arr
})
const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)))
const paged = computed(() => sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize))

const summary = computed(() => {
  const a = filteredAccelerators.value
  return {
    total: a.length,
    healthy: a.filter((x) => x.health_status === 'healthy').length,
    allocated: a.filter((x) => x.allocated).length,
    errors: a.reduce((s, x) => s + x.xid_errors + x.ecc_errors, 0),
    avgTemp: Math.round(a.reduce((s, x) => s + x.temp_c, 0) / (a.length || 1)),
    avgPower: Math.round(a.reduce((s, x) => s + x.power_w, 0) / (a.length || 1))
  }
})

function utilColor(v) {
  if (v >= 70) return '#37e0a0'; if (v >= 40) return '#38e1ff'; if (v >= 20) return '#ffb648'; return '#ff5f6d'
}
function tempColor(v) { return v > 86 ? '#ff5f6d' : v > 78 ? '#ffb648' : '#9aa7ba' }
const srcTone = { healthy: 'text-cyber-green', stale: 'text-cyber-amber', missing: 'text-cyber-red' }

const COLS = [
  { k: 'health_status', label: 'Status' },
  { k: 'node_id', label: 'Node · Dev' },
  { k: 'model_label', label: 'Model' },
  { k: 'job_name', label: 'Current Job' },
  { k: 'util_pct', label: 'Compute', metric: 'accelerator.utilization.compute.pct' },
  { k: 'mem_pct', label: 'Memory', metric: 'accelerator.memory.used.pct' },
  { k: 'temp_c', label: 'Temp', metric: 'accelerator.temperature.celsius' },
  { k: 'power_w', label: 'Power', metric: 'accelerator.power.watt' },
  { k: 'errors', label: 'Errors' },
  { k: 'source_status', label: 'Source' }
]
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-end justify-between">
      <div>
        <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">Compute Resources</h2>
        <p class="text-[14px] text-steel mt-0.5">Region → Cluster → Node → accelerator inventory with hardware health.</p>
      </div>
    </header>

    <FilterBar />

    <!-- inventory summary -->
    <section class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <SumCard :icon="Server" label="Total Cards" :value="summary.total" tone="#38e1ff" />
      <SumCard :icon="Cpu" label="Healthy" :value="summary.healthy" tone="#37e0a0" />
      <SumCard :icon="Cpu" label="Allocated" :value="summary.allocated" tone="#8b7bff" />
      <SumCard :icon="AlertTriangle" label="HW Errors" :value="summary.errors" :tone="summary.errors ? '#ff5f6d' : '#5e6b7e'" />
      <SumCard :icon="Zap" label="Avg Temp" :value="summary.avgTemp + '°C'" tone="#ffb648" />
      <SumCard :icon="Zap" label="Avg Power" :value="summary.avgPower + 'W'" tone="#9cff57" />
    </section>

    <!-- resource table (dark cyber data grid) -->
    <section class="cy-panel overflow-hidden">
      <div class="overflow-x-auto scroll-thin on-dark">
        <table class="w-full min-w-[980px]">
          <thead>
            <tr class="border-b border-cyber-line">
              <th v-for="c in COLS" :key="c.k"
                class="text-left text-[11px] font-semibold uppercase tracking-wide text-cyber-text-3 px-3 py-2.5 whitespace-nowrap cursor-pointer select-none"
                @click="setSort(c.k === 'errors' ? 'xid_errors' : c.k)">
                <span class="inline-flex items-center gap-1">
                  <MetricTooltip v-if="c.metric" :metric-id="c.metric" :label="c.label" dark />
                  <template v-else>{{ c.label }}</template>
                  <ArrowUpDown :size="11" class="text-cyber-text-3" />
                </span>
              </th>
              <th class="w-8" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in paged" :key="a.accelerator_id"
              class="border-b border-cyber-line-soft hover:bg-cyber-panel-2 transition-colors cursor-pointer group"
              @click="m.openDrawer('accelerator', a.accelerator_id)">
              <td class="px-3 py-2.5"><StatusBadge :status="a.health_status" dark /></td>
              <td class="px-3 py-2.5 font-mono text-[12.5px] text-cyber-text whitespace-nowrap">{{ a.node_id }}<span class="text-cyber-text-3">·{{ a.device_index }}</span></td>
              <td class="px-3 py-2.5 text-[12.5px] text-cyber-text-2 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full" :style="{ background: accent(a.accent) }" />
                  {{ a.model_label.replace(' Blackwell','').replace(' PPU','') }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-[12.5px] font-mono whitespace-nowrap" :class="a.job_name ? 'text-cyber-cyan' : 'text-cyber-text-3'">{{ a.job_name || '—' }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="cy-readout text-[13px] w-9" :style="{ color: utilColor(a.util_pct) }">{{ a.util_pct }}%</span>
                  <Sparkline :data="a.spark" :color="utilColor(a.util_pct)" :width="56" :height="20" :fill="false" />
                </div>
              </td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="cy-readout text-[13px] text-cyber-text-2 w-9">{{ a.mem_pct }}%</span>
                  <div class="h-1.5 w-12 rounded-full bg-cyber-line overflow-hidden">
                    <div class="h-full rounded-full bg-cyber-violet" :style="{ width: a.mem_pct + '%' }" />
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 cy-readout text-[13px]" :style="{ color: tempColor(a.temp_c) }">{{ a.temp_c }}°</td>
              <td class="px-3 py-2.5 cy-readout text-[13px] text-cyber-text-2">{{ a.power_w }}<span class="text-cyber-text-3 text-[11px]">W</span></td>
              <td class="px-3 py-2.5">
                <span v-if="a.xid_errors || a.ecc_errors" class="cy-readout text-[12px] text-cyber-red">
                  {{ a.xid_errors ? a.xid_errors + ' Xid' : '' }}{{ a.ecc_errors ? ' ' + a.ecc_errors + ' ECC' : '' }}
                </span>
                <span v-else class="text-cyber-text-3 text-[12px]">none</span>
              </td>
              <td class="px-3 py-2.5"><span class="text-[12px] font-medium capitalize" :class="srcTone[a.source_status]">{{ a.source_status }}</span></td>
              <td class="px-2"><ChevronRight :size="15" class="text-cyber-text-3 opacity-0 group-hover:opacity-100 transition-opacity" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-cyber-line">
        <span class="text-[12px] text-cyber-text-2 cy-readout">{{ sorted.length }} accelerators · page {{ page }}/{{ pageCount }}</span>
        <div class="flex gap-1.5">
          <button class="px-3 h-8 rounded-md border border-cyber-line text-[12.5px] text-cyber-text-2 hover:bg-cyber-panel-2 disabled:opacity-40 transition-colors"
            :disabled="page === 1" @click="page--">Prev</button>
          <button class="px-3 h-8 rounded-md border border-cyber-line text-[12.5px] text-cyber-text-2 hover:bg-cyber-panel-2 disabled:opacity-40 transition-colors"
            :disabled="page === pageCount" @click="page++">Next</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { h } from 'vue'
const ACCENT = { cyan: '#38e1ff', violet: '#8b7bff', lime: '#9cff57', amber: '#ffb648' }
function accent(a) { return ACCENT[a] || '#38e1ff' }
const SumCard = (props) =>
  h('div', { class: 'cy-panel p-3.5' }, [
    h('div', { class: 'flex items-center justify-between' }, [
      h('span', { class: 'micro-label text-cyber-text-3' }, props.label),
      props.icon ? h(props.icon, { size: 14, style: { color: props.tone } }) : null
    ]),
    h('div', { class: 'mt-2 cy-readout text-[22px] font-semibold', style: { color: props.tone } }, String(props.value))
  ])
SumCard.props = ['icon', 'label', 'value', 'tone']
export default { components: { SumCard }, methods: { accent } }
</script>
