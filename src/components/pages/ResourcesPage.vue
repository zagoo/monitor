<script setup>
import { ref, computed } from 'vue'
import { Server, Cpu, Zap, AlertTriangle, ArrowUpDown, ChevronRight } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import FilterBar from '../shell/FilterBar.vue'
import StatusBadge from '../common/StatusBadge.vue'
import Sparkline from '../common/Sparkline.vue'
import MetricTooltip from '../common/MetricTooltip.vue'

const m = useMonitor()
const { filteredAccelerators, filteredNodes } = m

const resourceView = ref('cards') // cards | nodes
const NODE_COLS = [
  { label: 'CPU', metric: 'system.cpu.utilization.pct' },
  { label: 'IOWait', metric: 'system.cpu.iowait.pct' },
  { label: '内存', metric: 'system.memory.used.pct' },
  { label: 'NUMA', metric: 'system.numa.imbalance' },
  { label: 'OOM', metric: 'system.oom.kill.events' },
  { label: 'NVLink', metric: 'network.nvlink.bandwidth' },
  { label: 'RoCE/IB', metric: 'network.fabric.bandwidth' },
  { label: 'PFC/ECN', metric: 'network.fabric.pfc_ecn' },
  { label: '端口宕机', metric: 'network.port.down.events' },
  { label: '误码', metric: 'network.bit.errors' },
  { label: 'P99', metric: 'network.latency.p99.us' },
  { label: 'Pod 重启', metric: 'k8s.pod.restarts' },
  { label: 'Req/Limit', metric: 'k8s.resource.request_limit' },
  { label: '等待调度', metric: 'k8s.pod.pending.seconds' },
  { label: '调度失败', metric: 'k8s.schedule.failures' },
  { label: '退出码', metric: 'k8s.pod.exit_code' },
  { label: '链路', metric: 'network.intra.link_status' }
]
function pctColor(v) { return v >= 85 ? '#ff5f6d' : v >= 65 ? '#ffb648' : '#9aa7ba' }
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
  { k: 'health_status', label: '状态' },
  { k: 'node_id', label: '节点 · 设备' },
  { k: 'model_label', label: '型号' },
  { k: 'job_name', label: '当前作业' },
  { k: 'util_pct', label: '计算', metric: 'accelerator.utilization.compute.pct' },
  { k: 'mem_pct', label: '显存', metric: 'accelerator.memory.used.pct' },
  { k: 'mem_bw_pct', label: '显存带宽', metric: 'accelerator.memory.bandwidth.pct' },
  { k: 'temp_c', label: '温度', metric: 'accelerator.temperature.celsius' },
  { k: 'power_w', label: '功耗', metric: 'accelerator.power.watt' },
  { k: 'errors', label: '错误' },
  { k: 'source_status', label: '采集' }
]
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-end justify-between">
      <div>
        <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">算力资源</h2>
        <p class="text-[14px] text-steel mt-0.5">区域 → 集群 → 节点 → 加速卡 的资源清单与硬件健康。</p>
      </div>
    </header>

    <FilterBar />

    <!-- inventory summary -->
    <section class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <SumCard :icon="Server" label="加速卡总数" :value="summary.total" tone="#38e1ff" />
      <SumCard :icon="Cpu" label="健康" :value="summary.healthy" tone="#37e0a0" />
      <SumCard :icon="Cpu" label="已分配" :value="summary.allocated" tone="#8b7bff" />
      <SumCard :icon="AlertTriangle" label="硬件错误" :value="summary.errors" :tone="summary.errors ? '#ff5f6d' : '#5e6b7e'" />
      <SumCard :icon="Zap" label="平均温度" :value="summary.avgTemp + '°C'" tone="#ffb648" />
      <SumCard :icon="Zap" label="平均功耗" :value="summary.avgPower + 'W'" tone="#9cff57" />
    </section>

    <!-- view tabs: accelerator grid / node-system grid -->
    <div class="flex items-center gap-1.5">
      <button class="nz-pill" :class="resourceView === 'cards' ? 'nz-pill-active' : ''" @click="resourceView = 'cards'">加速卡</button>
      <button class="nz-pill" :class="resourceView === 'nodes' ? 'nz-pill-active' : ''" @click="resourceView = 'nodes'">节点 / 系统</button>
    </div>

    <!-- resource table (dark cyber data grid) -->
    <section v-if="resourceView === 'cards'" class="cy-panel overflow-hidden">
      <div class="overflow-x-auto scroll-thin on-dark">
        <table class="w-full min-w-[1060px]">
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
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="cy-readout text-[13px] text-cyber-text-2 w-9">{{ a.mem_bw_pct }}%</span>
                  <div class="h-1.5 w-12 rounded-full bg-cyber-line overflow-hidden">
                    <div class="h-full rounded-full bg-cyber-cyan" :style="{ width: a.mem_bw_pct + '%' }" />
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 cy-readout text-[13px]" :style="{ color: tempColor(a.temp_c) }">{{ a.temp_c }}°</td>
              <td class="px-3 py-2.5 cy-readout text-[13px] text-cyber-text-2">{{ a.power_w }}<span class="text-cyber-text-3 text-[11px]">W</span></td>
              <td class="px-3 py-2.5">
                <span v-if="a.xid_errors || a.ecc_errors" class="cy-readout text-[12px] text-cyber-red">
                  {{ a.xid_errors ? a.xid_errors + ' Xid' : '' }}{{ a.ecc_errors ? ' ' + a.ecc_errors + ' ECC' : '' }}
                </span>
                <span v-else class="text-cyber-text-3 text-[12px]">无</span>
              </td>
              <td class="px-3 py-2.5"><span class="text-[12px] font-medium capitalize" :class="srcTone[a.source_status]">{{ a.source_status }}</span></td>
              <td class="px-2"><ChevronRight :size="15" class="text-cyber-text-3 opacity-0 group-hover:opacity-100 transition-opacity" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- pagination -->
      <div class="flex items-center justify-between px-4 py-3 border-t border-cyber-line">
        <span class="text-[12px] text-cyber-text-2 cy-readout">{{ sorted.length }} 张加速卡 · 第 {{ page }}/{{ pageCount }} 页</span>
        <div class="flex gap-1.5">
          <button class="px-3 h-8 rounded-md border border-cyber-line text-[12.5px] text-cyber-text-2 hover:bg-cyber-panel-2 disabled:opacity-40 transition-colors"
            :disabled="page === 1" @click="page--">上一页</button>
          <button class="px-3 h-8 rounded-md border border-cyber-line text-[12.5px] text-cyber-text-2 hover:bg-cyber-panel-2 disabled:opacity-40 transition-colors"
            :disabled="page === pageCount" @click="page++">下一页</button>
        </div>
      </div>
    </section>

    <!-- node / system + network table -->
    <section v-else class="cy-panel overflow-hidden">
      <div class="px-4 py-2.5 border-b border-cyber-line flex items-center justify-between">
        <span class="text-[13px] font-semibold text-cyber-text">{{ filteredNodes.length }} 个节点 · 系统 / 网络 / Kubernetes</span>
        <span class="micro-label text-cyber-text-3">Region → Cluster → Node</span>
      </div>
      <div class="overflow-x-auto scroll-thin on-dark">
        <table class="w-full min-w-[1180px]">
          <thead>
            <tr class="border-b border-cyber-line text-[11px] uppercase tracking-wide text-cyber-text-3">
              <th class="text-left px-3 py-2.5">状态</th>
              <th class="text-left px-3 py-2.5">节点</th>
              <th class="text-left px-3 py-2.5">区域</th>
              <th class="text-right px-3 py-2.5">卡数</th>
              <th v-for="c in NODE_COLS" :key="c.metric" class="text-right px-3 py-2.5 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 justify-end"><MetricTooltip :metric-id="c.metric" :label="c.label" dark /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in filteredNodes" :key="n.node_id" class="border-b border-cyber-line-soft hover:bg-cyber-panel-2 transition-colors">
              <td class="px-3 py-2.5"><StatusBadge :status="n.health" dark /></td>
              <td class="px-3 py-2.5 font-mono text-[12.5px] text-cyber-text whitespace-nowrap">{{ n.node_id }}</td>
              <td class="px-3 py-2.5 text-[12.5px] text-cyber-text-2 whitespace-nowrap">{{ n.region_name }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.card_count }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :style="{ color: pctColor(n.cpu_pct) }">{{ n.cpu_pct }}%</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :style="{ color: n.iowait_pct > 12 ? '#ffb648' : '#9aa7ba' }">{{ n.iowait_pct }}%</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :style="{ color: pctColor(n.mem_pct) }">{{ n.mem_pct }}%</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.numa_imbalance }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.oom_kills ? 'text-cyber-red' : 'text-cyber-text-3'">{{ n.oom_kills }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.nvlink_bw_gbs }}<span class="text-cyber-text-3 text-[10px]">GB/s</span></td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.fabric_bw_gbps }}<span class="text-cyber-text-3 text-[10px]">Gb/s</span></td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.pfc_ecn > 100 ? 'text-cyber-amber' : 'text-cyber-text-2'">{{ n.pfc_ecn }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.port_down ? 'text-cyber-red' : 'text-cyber-text-3'">{{ n.port_down }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.bit_errors > 30 ? 'text-cyber-amber' : 'text-cyber-text-2'">{{ n.bit_errors }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.net_p99_us }}<span class="text-cyber-text-3 text-[10px]">µs</span></td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.pod_restarts ? 'text-cyber-amber' : 'text-cyber-text-3'">{{ n.pod_restarts }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px] text-cyber-text-2">{{ n.req_limit_ratio }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.pending_p95_s > 120 ? 'text-cyber-amber' : 'text-cyber-text-2'">{{ n.pending_p95_s }}<span class="text-cyber-text-3 text-[10px]">s</span></td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.schedule_failures ? 'text-cyber-amber' : 'text-cyber-text-3'">{{ n.schedule_failures }}</td>
              <td class="px-3 py-2.5 text-right cy-readout text-[13px]" :class="n.exit_code && n.exit_code !== 0 ? 'text-cyber-red' : 'text-cyber-text-3'">{{ n.exit_code }}</td>
              <td class="px-3 py-2.5 text-right text-[12px] font-medium" :class="n.link_status === 'up' ? 'text-cyber-green' : n.link_status === 'degraded' ? 'text-cyber-amber' : 'text-cyber-red'">{{ ({ up: '正常', degraded: '降级', down: '中断' })[n.link_status] }}</td>
            </tr>
          </tbody>
        </table>
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
