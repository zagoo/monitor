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
const { state, kpis, regionModelMatrix, tenantModelMatrix, topN } = m

// matrix tab: tenant (default) | region
const matrixTab = ref('tenant')
const matrix = computed(() => (matrixTab.value === 'tenant' ? tenantModelMatrix.value : regionModelMatrix.value))
function rowName(row) { return matrixTab.value === 'tenant' ? row.tenant.name : row.region.region_name }
function rowDot(row) { return matrixTab.value === 'tenant' ? '#38e1ff' : (row.region.status === 'online' ? '#37e0a0' : '#ffb648') }

const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : `${n}`

const heroSpark = computed(() => state.accelerators.slice(0, 24).map((a) => a.util_pct))

const topTab = ref('abnormal')
const TOP_TABS = [
  { id: 'abnormal', label: '异常' },
  { id: 'lowUtil', label: '低利用' },
  { id: 'slowJobs', label: '慢作业' },
  { id: 'cost', label: '成本' }
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
  if (matrixTab.value === 'tenant') m.rawState.filters.tenant_ids = [cell.tenant_id]
  else m.rawState.filters.region_ids = [cell.region_id]
  m.rawState.filters.accelerator_models = [cell.model]
  m.setTab('resources')
}
function openAcc(a) { m.openDrawer('accelerator', a.accelerator_id) }
function openJob(j) { m.openDrawer('job', j.job_id) }
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
          <span class="micro-label text-cyber-cyan">全局算力健康</span>
          <span
            class="nz-chip border-transparent text-[11px]"
            :class="state.dataStatus === 'complete' ? 'bg-white/10 text-white/80' : 'bg-warning/20 text-warning'"
          >{{ state.dataStatus === 'complete' ? '全部区域上报中' : '数据不完整' }}</span>
        </div>
        <h1 class="mt-2 text-[34px] font-semibold leading-tight">机群平均利用率 {{ kpis.avg_util }}%</h1>
        <p class="mt-1 text-[14px] text-on-dark-muted">
          {{ m.REGIONS.length }} 个区域共 {{ kpis.total }} 张加速卡 ·
          {{ kpis.active }} 张正在训练 · {{ kpis.p0 }} 条 P0 告警待处理
        </p>
      </div>

      <!-- right mini-KPI workspace card (§12.3.1) -->
      <div class="relative z-10 hidden lg:block w-[420px] h-[132px] rounded-lg bg-canvas shadow-nz-3 ml-6">
        <div class="grid grid-cols-4 h-full divide-x divide-hairline">
          <MiniKpi label="健康" :value="kpis.availability_pct + '%'" tone="#1aae39" />
          <MiniKpi label="活跃" :value="kpis.active" tone="#5645d4" />
          <MiniKpi label="告警" :value="kpis.p0" :tone="kpis.p0 ? '#e03131' : '#a4a097'" />
          <MiniKpi label="浪费/时" :value="'$' + fmt(kpis.waste_cost)" tone="#dd5b00" />
        </div>
      </div>
    </section>

    <FilterBar />

    <!-- ── KPI Cards · two rows of four (dark cyber) ── -->
    <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard label="加速卡总数" :value="kpis.total"
        icon="Boxes" accent="#38e1ff" metric-id="fleet.cards.total" />
      <KpiCard label="可用卡数 / 可用率" :value="kpis.healthy" :sub="'可用率 ' + kpis.availability_pct + '%'"
        icon="HeartPulse" accent="#37e0a0" :spark="heroSpark" :delta="0.6" delta-good="up" metric-id="fleet.cards.available" />
      <KpiCard label="已分配卡数 / 分配率" :value="kpis.allocated" :sub="'分配率 ' + kpis.allocation_pct + '%'"
        icon="Server" accent="#8b7bff" :delta="0.4" delta-good="up" metric-id="fleet.cards.allocated" />
      <KpiCard label="活跃训练卡数" :value="kpis.active" :sub="'已分配 ' + kpis.allocated"
        icon="Activity" accent="#38e1ff" :spark="heroSpark.map(v => v*0.9)" :delta="-1.2" delta-good="up" metric-id="fleet.cards.active" />

      <KpiCard label="平均计算利用率" :value="kpis.avg_util" unit="%"
        icon="Gauge" accent="#8b7bff" :spark="heroSpark" :delta="2.4" delta-good="up" metric-id="fleet.util.compute.avg" />
      <KpiCard label="SM/Warp 占用率" :value="kpis.avg_sm" unit="%"
        icon="Layers" accent="#ffb648" :spark="heroSpark.map(v => v*0.8)" :delta="1.1" delta-good="up" metric-id="expert.sm.occupancy.pct" />
      <KpiCard label="MFU" :value="kpis.avg_mfu" unit="%"
        icon="Gauge" accent="#37e0a0" :spark="heroSpark.map(v => v*0.6)" :delta="0.8" delta-good="up" metric-id="training.mfu.pct" />
      <KpiCard label="张量/矩阵单元利用率" :value="kpis.avg_tensor" unit="%"
        icon="Zap" accent="#9cff57" :spark="heroSpark.map(v => v*0.85)" :delta="1.6" delta-good="up" metric-id="accelerator.utilization.tensor.pct" />
    </section>

    <!-- ── Supplementary metrics strip ── -->
    <section class="cy-panel p-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SubStat label="平均显存利用率" metric-id="fleet.util.memory.avg" :value="kpis.avg_mem + '%'" color="#8b7bff" />
        <SubStat label="温度/功率受限卡数" metric-id="fleet.cards.thermal_power_limited" :value="kpis.thermal" :color="kpis.thermal ? '#ffb648' : '#5e6b7e'" />
        <SubStat label="集群总吞吐" metric-id="training.throughput.cluster" :value="fmt(kpis.throughput) + ' tok/s'" color="#38e1ff" />
        <SubStat label="空闲卡时" metric-id="cost.idle_card_hours" :value="fmt(kpis.idle_card_hours)" color="#ff8a3d" />
        <SubStat label="P0 告警" metric-id="alerts.p0.count" :value="kpis.p0" :color="kpis.p0 ? '#ff5f6d' : '#37e0a0'" />
      </div>
    </section>

    <!-- ── Matrix + TopN row ── -->
    <section class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <!-- Region × Model matrix -->
      <div class="cy-panel xl:col-span-8 p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              class="px-2.5 h-7 rounded-full text-[12.5px] font-medium transition-colors"
              :class="matrixTab === 'tenant' ? 'bg-cyber-cyan/15 text-cyber-cyan' : 'text-cyber-text-2 hover:text-cyber-text'"
              @click="matrixTab = 'tenant'"
            >租户 × 加速卡矩阵</button>
            <button
              class="px-2.5 h-7 rounded-full text-[12.5px] font-medium transition-colors"
              :class="matrixTab === 'region' ? 'bg-cyber-cyan/15 text-cyber-cyan' : 'text-cyber-text-2 hover:text-cyber-text'"
              @click="matrixTab = 'region'"
            >区域 × 加速卡矩阵</button>
            <MetricTooltip metric-id="accelerator.utilization.compute.pct" icon-only dark />
          </div>
          <span class="text-[11px] text-cyber-text-3 cy-readout">健康率 · 平均利用率 · P0 数 · 加权汇总</span>
        </div>

        <div class="overflow-x-auto scroll-thin on-dark">
          <table class="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th class="text-left text-[11px] font-semibold uppercase tracking-wide text-cyber-text-3 pl-1 pb-1 w-28">{{ matrixTab === 'tenant' ? '租户' : '区域' }}</th>
                <th v-for="mod in matrix.models" :key="mod.model"
                  class="text-[11px] font-semibold uppercase tracking-wide text-cyber-text-3 pb-1 px-1 text-center">
                  {{ mod.label.replace(' Blackwell','').replace(' PPU','') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in matrix.rows" :key="ri">
                <td class="text-[12.5px] text-cyber-text pl-1 pr-2 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: rowDot(row) }" />
                    {{ rowName(row) }}
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
                    <span class="text-[10.5px] text-cyber-text-2 cy-readout">{{ cell.count }} 卡 · {{ cell.health_pct }}%</span>
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
  </div>
</template>

<script>
import { h } from 'vue'
import MetricTooltipC from '../common/MetricTooltip.vue'
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
const SubStat = (props) =>
  h('div', { class: 'rounded-lg border border-cyber-line bg-cyber-panel-2 p-3' }, [
    h('div', { class: 'flex items-center gap-1' }, [
      h('span', { class: 'micro-label text-cyber-text-3' }, props.label),
      props.metricId ? h(MetricTooltipC, { metricId: props.metricId, iconOnly: true, dark: true }) : null
    ]),
    h('div', { class: 'mt-1.5 cy-readout text-[19px] font-semibold', style: { color: props.color } }, String(props.value))
  ])
SubStat.props = ['label', 'value', 'color', 'metricId']
export default { components: { MiniKpi, SubStat }, methods: { utilColor, dotStyle } }
</script>
