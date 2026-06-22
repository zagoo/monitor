<script setup>
import { ref, computed } from 'vue'
import {
  HeartPulse, Cpu, Gauge, BellRing, ChevronRight, Flame, Snowflake, DollarSign, ArrowRight
} from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { ACCELERATOR_TYPES } from '../../data/catalog.js'
import FilterBar from '../shell/FilterBar.vue'
import KpiCard from '../common/KpiCard.vue'
import StatusBadge from '../common/StatusBadge.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

const m = useMonitor()
const { state, kpis, regionModelMatrix, topN, timeline } = m

const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : `${n}`

const heroSpark = computed(() => state.accelerators.slice(0, 24).map((a) => a.util_pct))

const topTab = ref('abnormal')
const TOP_TABS = [
  { id: 'abnormal', label: 'Abnormal' },
  { id: 'lowUtil', label: 'Low Util' },
  { id: 'slowJobs', label: 'Slow Jobs' },
  { id: 'cost', label: 'Cost' }
]
const topRows = computed(() => topN.value[topTab.value])

// matrix cell pastel scale by utilization
function cellTint(util) {
  if (util >= 70) return 'bg-tint-mint'
  if (util >= 45) return 'bg-tint-sky'
  if (util >= 20) return 'bg-tint-yellow'
  return 'bg-tint-peach'
}
function modelLabel(model) { return ACCELERATOR_TYPES.find((t) => t.model === model)?.label || model }

function openCell(cell) {
  if (cell.empty) return
  m.resetFilters()
  m.rawState.filters.region_ids = [cell.region_id]
  m.rawState.filters.accelerator_models = [cell.model]
  m.setTab('resources')
}
function openAcc(a) { m.openDrawer('accelerator', a.accelerator_id) }
function openJob(j) { m.openDrawer('job', j.job_id) }

const sevDot = { critical: '#ff5f6d', high: '#ffb648', medium: '#38e1ff', low: '#9aa7ba' }
</script>

<template>
  <div class="space-y-4">
    <!-- ── Hero Summary Band (PRD §12.3.1) ── -->
    <section class="relative overflow-hidden rounded-2xl bg-navy text-white p-8 min-h-[180px] flex items-center">
      <!-- decorative sticky dots -->
      <div class="pointer-events-none absolute inset-0 opacity-90">
        <span v-for="(d, i) in 11" :key="i"
          class="absolute h-2.5 w-2.5 rounded-full"
          :style="dotStyle(i)" />
      </div>
      <div class="relative flex-1 z-10">
        <div class="flex items-center gap-2.5">
          <span class="cy-dot-live" />
          <span class="micro-label text-cyber-cyan">Global Compute Health</span>
          <span
            class="nz-chip border-transparent text-[11px]"
            :class="state.dataStatus === 'complete' ? 'bg-white/10 text-white/80' : 'bg-warning/20 text-warning'"
          >{{ state.dataStatus === 'complete' ? 'All regions reporting' : 'Partial data' }}</span>
        </div>
        <h1 class="mt-2 text-[34px] font-semibold leading-tight">Fleet running at {{ kpis.avg_util }}% average utilization</h1>
        <p class="mt-1 text-[14px] text-on-dark-muted">
          {{ kpis.total }} accelerators across {{ m.REGIONS.length }} regions ·
          {{ kpis.active }} actively training · {{ kpis.p0 }} P0 alerts open
        </p>
      </div>

      <!-- right mini-KPI workspace card (§12.3.1) -->
      <div class="relative z-10 hidden lg:block w-[420px] h-[132px] rounded-lg bg-canvas shadow-nz-3 ml-6">
        <div class="grid grid-cols-4 h-full divide-x divide-hairline">
          <MiniKpi label="Healthy" :value="kpis.availability_pct + '%'" tone="#1aae39" />
          <MiniKpi label="Active" :value="kpis.active" tone="#5645d4" />
          <MiniKpi label="Alerts" :value="kpis.p0" :tone="kpis.p0 ? '#e03131' : '#a4a097'" />
          <MiniKpi label="Waste/h" :value="'$' + fmt(kpis.waste_cost)" tone="#dd5b00" />
        </div>
      </div>
    </section>

    <FilterBar />

    <!-- ── KPI Cards row (dark cyber) ── -->
    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard label="Available Cards" :value="kpis.healthy" :sub="kpis.availability_pct + '% availability'"
        icon="HeartPulse" accent="#37e0a0" :spark="heroSpark" :delta="0.6" delta-good="up" />
      <KpiCard label="Active Training" :value="kpis.active" :sub="kpis.allocated + ' allocated'"
        icon="Cpu" accent="#38e1ff" :spark="heroSpark.map(v => v*0.9)" :delta="-1.2" delta-good="up" />
      <KpiCard label="Avg Compute Util" :value="kpis.avg_util" unit="%"
        icon="Gauge" accent="#8b7bff" :spark="heroSpark" :delta="2.4" delta-good="up" />
      <KpiCard label="P0 Alerts" :value="kpis.p0" :sub="kpis.hw_err + ' hw events'"
        icon="BellRing" :accent="kpis.p0 ? '#ff5f6d' : '#37e0a0'" :delta="kpis.p0 ? 1 : 0" delta-good="down" />
    </section>

    <!-- ── Matrix + TopN row ── -->
    <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <!-- Region × Model matrix -->
      <div class="cy-panel xl:col-span-8 p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-[15px] font-semibold text-cyber-text flex items-center gap-2">
              Region × Accelerator Matrix
            </h3>
            <p class="text-[12px] text-cyber-text-2 mt-0.5">Health rate · avg utilization · P0 count — click a cell to drill in</p>
          </div>
          <span class="text-[11px] text-cyber-text-3 cy-readout">weighted rollup</span>
        </div>

        <div class="overflow-x-auto scroll-thin on-dark">
          <table class="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th class="text-left text-[11px] font-semibold uppercase tracking-wide text-cyber-text-3 pl-1 pb-1 w-28">Region</th>
                <th v-for="mod in regionModelMatrix.models" :key="mod.model"
                  class="text-[11px] font-semibold uppercase tracking-wide text-cyber-text-3 pb-1 px-1 text-center">
                  {{ mod.label.replace(' Blackwell','').replace(' PPU','') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in regionModelMatrix.rows" :key="row.region.region_id">
                <td class="text-[12.5px] text-cyber-text pl-1 pr-2 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: row.region.status==='online' ? '#37e0a0' : '#ffb648' }" />
                    {{ row.region.region_name }}
                  </div>
                </td>
                <td v-for="cell in row.cells" :key="cell.model" class="p-0">
                  <button
                    v-if="!cell.empty"
                    class="w-full h-16 rounded-md border border-cyber-line bg-cyber-panel-2 hover:border-cyber-cyan/60 transition-all px-2 flex flex-col items-center justify-center gap-0.5 relative group"
                    @click="openCell(cell)"
                  >
                    <span class="absolute top-1 right-1.5 cy-readout text-[10px]" :class="cell.p0 ? 'text-cyber-red' : 'text-cyber-text-3'">
                      {{ cell.p0 ? '●'+cell.p0 : '' }}
                    </span>
                    <span class="cy-readout text-[17px] font-semibold" :style="{ color: utilColor(cell.avg_util) }">{{ cell.avg_util }}%</span>
                    <span class="text-[10.5px] text-cyber-text-2 cy-readout">{{ cell.count }} cards · {{ cell.health_pct }}%</span>
                  </button>
                  <div v-else class="w-full h-16 rounded-md border border-dashed border-cyber-line-soft grid place-items-center text-[11px] text-cyber-text-3">—</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TopN -->
      <div class="cy-panel xl:col-span-4 p-5 flex flex-col">
        <div class="flex items-center gap-1 mb-3 flex-wrap">
          <button v-for="t in TOP_TABS" :key="t.id"
            class="px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors"
            :class="topTab === t.id ? 'bg-cyber-cyan/15 text-cyber-cyan' : 'text-cyber-text-2 hover:text-cyber-text'"
            @click="topTab = t.id"
          >{{ t.label }}</button>
        </div>
        <div class="flex-1 space-y-0.5 overflow-y-auto scroll-thin on-dark -mr-1 pr-1">
          <!-- accelerator-style rows -->
          <template v-if="topTab === 'abnormal' || topTab === 'lowUtil'">
            <button v-for="(a, i) in topRows" :key="a.accelerator_id"
              class="w-full flex items-center gap-3 h-11 px-2 rounded-md hover:bg-cyber-panel-2 transition-colors text-left"
              @click="openAcc(a)">
              <span class="cy-readout text-[12px] text-cyber-text-3 w-4">{{ i + 1 }}</span>
              <span class="h-1.5 w-1.5 rounded-full shrink-0" :style="{ background: a.health_status==='critical' || a.offline ? '#ff5f6d' : a.health_status==='warning' ? '#ffb648' : '#38e1ff' }" />
              <div class="min-w-0 flex-1">
                <div class="text-[12.5px] text-cyber-text truncate font-mono">{{ a.node_id }}·{{ a.device_index }}</div>
                <div class="text-[11px] text-cyber-text-3 truncate">{{ a.region_name }} · {{ a.model_label.split(' ')[0] }}</div>
              </div>
              <span class="cy-readout text-[13px]" :style="{ color: topTab==='lowUtil' ? '#ffb648' : utilColor(a.util_pct) }">
                {{ topTab === 'lowUtil' ? a.util_pct + '%' : (a.offline ? 'OFF' : a.temp_c + '°') }}
              </span>
              <ChevronRight :size="14" class="text-cyber-text-3" />
            </button>
          </template>
          <!-- job rows -->
          <template v-else>
            <button v-for="(j, i) in topRows" :key="j.job_id"
              class="w-full flex items-center gap-3 h-11 px-2 rounded-md hover:bg-cyber-panel-2 transition-colors text-left"
              @click="openJob(j)">
              <span class="cy-readout text-[12px] text-cyber-text-3 w-4">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <div class="text-[12.5px] text-cyber-text truncate font-mono">{{ j.job_name }}</div>
                <div class="text-[11px] text-cyber-text-3 truncate">{{ j.tenant_name }} · {{ j.framework }}</div>
              </div>
              <span class="cy-readout text-[13px] text-cyber-amber">
                {{ topTab === 'cost' ? '$' + j.cost_per_mtok : (j.comm_wait_pct + j.data_wait_pct).toFixed(0) + '%' }}
              </span>
              <ChevronRight :size="14" class="text-cyber-text-3" />
            </button>
          </template>
        </div>
      </div>
    </section>

    <!-- ── Event timeline ── -->
    <section class="cy-panel p-5">
      <h3 class="text-[15px] font-semibold text-cyber-text mb-4">Event Timeline</h3>
      <div class="relative pl-4">
        <span class="absolute left-[5px] top-1 bottom-1 w-px bg-cyber-line" />
        <div v-for="e in timeline" :key="e.id" class="relative flex items-start gap-3 py-2">
          <span class="absolute -left-[11px] top-3 h-2.5 w-2.5 rounded-full border-2 border-cyber-bg" :style="{ background: sevDot[e.severity] }" />
          <span class="cy-readout text-[11px] text-cyber-text-3 w-14 shrink-0 pt-0.5">{{ e.min_ago }}m ago</span>
          <div class="min-w-0">
            <span class="text-[13px] font-medium text-cyber-text">{{ e.title }}</span>
            <span class="text-[12.5px] text-cyber-text-2"> — {{ e.detail }}</span>
          </div>
        </div>
        <p v-if="!timeline.length" class="text-[13px] text-cyber-text-3 py-4">No events in the selected window.</p>
      </div>
    </section>
  </div>
</template>

<script>
import { h } from 'vue'
// helpers shared in template scope
function utilColor(v) {
  if (v >= 70) return '#37e0a0'
  if (v >= 40) return '#38e1ff'
  if (v >= 20) return '#ffb648'
  return '#ff5f6d'
}
const DOTS = [
  ['#ff64c8', '8%', '18%'], ['#f5d75e', '14%', '62%'], ['#2a9d99', '22%', '30%'],
  ['#7b3ff2', '30%', '74%'], ['#1aae39', '40%', '20%'], ['#dd5b00', '52%', '66%'],
  ['#0075de', '60%', '36%'], ['#ff64c8', '70%', '78%'], ['#f5d75e', '80%', '24%'],
  ['#2a9d99', '88%', '60%'], ['#7b3ff2', '94%', '40%']
]
function dotStyle(i) {
  const d = DOTS[i % DOTS.length]
  return { background: d[0], left: d[1], top: d[2] }
}
const MiniKpi = (props) =>
  h('div', { class: 'flex flex-col items-center justify-center px-2' }, [
    h('span', { class: 'micro-label text-stone' }, props.label),
    h('span', { class: 'mt-1 text-[20px] font-semibold cy-readout', style: { color: props.tone } }, String(props.value))
  ])
MiniKpi.props = ['label', 'value', 'tone']
export default { components: { MiniKpi }, methods: { utilColor, dotStyle } }
</script>
