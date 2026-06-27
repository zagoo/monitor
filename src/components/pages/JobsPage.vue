<script setup>
import { ref, computed } from 'vue'
import { Search, Gauge, Timer, Coins, Activity, Layers, Maximize2 } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import { stepBreakdown, skewMatrix } from '../../data/jobAnalytics.js'
import MetricTooltip from '../common/MetricTooltip.vue'

const m = useMonitor()
const { filteredJobs } = m
const q = ref('')
const selectedId = ref(null)

const jobs = computed(() => {
  const t = q.value.trim().toLowerCase()
  return filteredJobs.value
    .filter((j) => !t || j.job_name.includes(t) || j.tenant_name.toLowerCase().includes(t))
    .sort((a, b) => (b.comm_wait_pct + b.data_wait_pct) - (a.comm_wait_pct + a.data_wait_pct))
})
const selected = computed(() => jobs.value.find((j) => j.job_id === selectedId.value) || jobs.value.find((j) => j.status === 'running') || jobs.value[0])

const breakdown = computed(() => selected.value ? stepBreakdown(selected.value) : [])
const skew = computed(() => selected.value ? skewMatrix(selected.value) : null)

function statusTone(s) { return s === 'running' ? 'text-cyber-green' : s === 'queued' ? 'text-cyber-amber' : 'text-cyber-text-3' }
const statusLabel = { running: '运行中', queued: '排队中', completed: '已完成' }
function mfuColor(v) { return v >= 45 ? '#37e0a0' : v >= 30 ? '#38e1ff' : '#ffb648' }
const skewColor = { normal: '#37e0a0', slight: '#ffb648', obvious: '#ff8a3d', severe: '#ff5f6d' }
const skewLabel = { normal: '正常', slight: '轻微', obvious: '明显', severe: '严重' }
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">训练作业</h2>
        <p class="text-[14px] text-steel mt-0.5">定位作业慢在哪：计算、通信、数据、checkpoint 或硬件偏差。</p>
      </div>
      <div class="relative w-72">
        <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
        <input v-model="q" class="nz-input w-full pl-9" placeholder="搜索作业或租户…" />
      </div>
    </header>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <!-- job list -->
      <div class="xl:col-span-5 cy-panel overflow-hidden">
        <div class="px-4 py-2.5 border-b border-cyber-line flex items-center justify-between">
          <span class="text-[13px] font-semibold text-cyber-text">{{ jobs.length }} 个作业</span>
          <span class="micro-label text-cyber-text-3">按等待排序</span>
        </div>
        <div class="max-h-[560px] overflow-y-auto scroll-thin on-dark">
          <button v-for="j in jobs" :key="j.job_id"
            class="w-full text-left px-4 py-3 border-b border-cyber-line-soft hover:bg-cyber-panel-2 transition-colors"
            :class="selected?.job_id === j.job_id ? 'bg-cyber-panel-2 border-l-2 border-l-cyber-cyan' : 'border-l-2 border-l-transparent'"
            @click="selectedId = j.job_id">
            <div class="flex items-center justify-between">
              <span class="font-mono text-[13px] text-cyber-text truncate">{{ j.job_name }}</span>
              <span class="text-[11px] font-medium" :class="statusTone(j.status)">● {{ statusLabel[j.status] || j.status }}</span>
            </div>
            <div class="mt-1 flex items-center gap-3 text-[11.5px] text-cyber-text-3">
              <span>{{ j.tenant_name }}</span><span>·</span><span>{{ j.cards }} 卡</span><span>·</span>
              <span class="cy-readout">MFU {{ j.mfu_pct }}%</span>
            </div>
            <div class="mt-1.5 flex gap-1.5">
              <span class="h-1 rounded-full bg-cyber-red/70" :style="{ width: j.comm_wait_pct * 2 + 'px' }" title="comm wait" />
              <span class="h-1 rounded-full bg-cyber-amber/70" :style="{ width: j.data_wait_pct * 2 + 'px' }" title="data wait" />
            </div>
          </button>
        </div>
      </div>

      <!-- selected job analysis -->
      <div v-if="selected" class="xl:col-span-7 space-y-4">
        <!-- summary cards -->
        <div class="cy-panel p-5">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-mono text-[16px] text-cyber-text">{{ selected.job_name }}</h3>
              <p class="text-[12.5px] text-cyber-text-2 mt-0.5">{{ selected.framework }} · {{ selected.parallel_strategy }} · {{ selected.tenant_name }} · {{ selected.cards }} 卡</p>
            </div>
            <button class="drw-btn" @click="m.openDrawer('job', selected.job_id)"><Maximize2 :size="13" />深入分析</button>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Stat :icon="Activity" label="吞吐" :value="(selected.tokens_per_s/1000).toFixed(1)+'k'" unit="tok/s" color="#38e1ff" metric-id="training.throughput.tokens" />
            <Stat :icon="Timer" label="Step P95" :value="selected.step_p95_ms" unit="ms" color="#8b7bff" metric-id="training.step.time.ms" />
            <Stat :icon="Gauge" label="MFU" :value="selected.mfu_pct" unit="%" :color="mfuColor(selected.mfu_pct)" metric-id="training.mfu.pct" />
            <Stat :icon="Coins" label="成本" :value="'$'+selected.cost_per_mtok" unit="/Mtok" color="#ffb648" metric-id="cost.per_million_tokens" />
          </div>
        </div>

        <!-- step time breakdown (stacked bar) -->
        <div class="cy-panel p-5">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-[14px] font-semibold text-cyber-text flex items-center gap-1.5">Step 耗时分解
              <MetricTooltip metric-id="training.step.breakdown" icon-only dark />
            </h4>
            <span class="cy-readout text-[12px] text-cyber-text-2">中位 {{ selected.step_p50_ms }} ms</span>
          </div>
          <div class="flex h-7 w-full rounded-md overflow-hidden border border-cyber-line">
            <div v-for="b in breakdown" :key="b.name" :style="{ width: b.pct + '%', background: b.color }"
              class="h-full relative group" :title="`${b.name} ${b.pct}%`" />
          </div>
          <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-3">
            <div v-for="b in breakdown" :key="b.name" class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: b.color }" />
              <span class="text-[12px] text-cyber-text-2">{{ b.name }}</span>
              <span class="cy-readout text-[12px] text-cyber-text ml-auto">{{ b.pct }}%</span>
            </div>
          </div>
        </div>

        <!-- accelerator skew matrix (§11.3.4) -->
        <div class="cy-panel p-5">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-[14px] font-semibold text-cyber-text flex items-center gap-2"><Layers :size="15" class="text-cyber-cyan" />加速卡偏差矩阵
              <MetricTooltip metric-id="training.wait.barrier.pct" icon-only dark />
            </h4>
            <span class="text-[11px] text-cyber-text-3">相对作业中位 step 耗时的偏差</span>
          </div>
          <div class="overflow-x-auto scroll-thin on-dark">
            <div class="inline-grid gap-1" :style="{ gridTemplateColumns: `auto repeat(${skew.cols}, 28px)` }">
              <div />
              <div v-for="c in skew.cols" :key="'h'+c" class="text-center text-[10px] text-cyber-text-3 cy-readout">d{{ c-1 }}</div>
              <template v-for="row in skew.rows" :key="row.node">
                <div class="text-[11px] text-cyber-text-3 font-mono pr-2 flex items-center whitespace-nowrap">{{ row.node }}</div>
                <div v-for="(cell, ci) in row.cells" :key="ci"
                  class="h-7 w-7 rounded-sm grid place-items-center cy-readout text-[9px] font-semibold cursor-default"
                  :style="{ background: skewColor[cell.level] + '22', color: skewColor[cell.level], boxShadow: cell.level==='severe' ? `0 0 8px ${skewColor[cell.level]}66` : 'none' }"
                  :title="`${row.node} dev${ci}: +${cell.dev}%`">
                  {{ cell.dev }}
                </div>
              </template>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-3 text-[11px] text-cyber-text-3">
            <span v-for="(c, k) in skewColor" :key="k" class="flex items-center gap-1">
              <span class="h-2 w-2 rounded-sm" :style="{ background: c }" />{{ skewLabel[k] }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { h } from 'vue'
import MetricTooltip from '../common/MetricTooltip.vue'
const Stat = (props) =>
  h('div', { class: 'rounded-lg border border-cyber-line bg-cyber-panel-2 p-3' }, [
    h('div', { class: 'flex items-center gap-1.5' }, [
      props.icon ? h(props.icon, { size: 13, style: { color: props.color } }) : null,
      h('span', { class: 'text-[10.5px] uppercase tracking-wide text-cyber-text-3' }, props.label),
      props.metricId ? h(MetricTooltip, { metricId: props.metricId, iconOnly: true, dark: true }) : null
    ]),
    h('div', { class: 'mt-1.5 flex items-baseline gap-1' }, [
      h('span', { class: 'cy-readout text-[20px] font-semibold', style: { color: props.color } }, String(props.value)),
      h('span', { class: 'cy-readout text-[11px] text-cyber-text-3' }, props.unit)
    ])
  ])
Stat.props = ['icon', 'label', 'value', 'unit', 'color', 'metricId']
export default { components: { Stat } }
</script>

<style scoped>
.drw-btn {
  display: inline-flex; align-items: center; gap: 0.35rem;
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #232b39; background: #161c27;
  color: #9aa7ba; font-size: 12.5px; font-weight: 500; transition: all 0.12s;
}
.drw-btn:hover { background: #1b222e; color: #e6edf6; border-color: #38e1ff66; }
</style>
