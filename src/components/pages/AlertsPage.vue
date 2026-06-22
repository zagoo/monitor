<script setup>
import { ref, computed } from 'vue'
import { BellRing, Check, BellOff, RotateCw, Repeat } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'

const m = useMonitor()
const sevFilter = ref('all')
const statusFilter = ref('all')

const SEV = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'P0' },
  { id: 'high', label: 'P1' },
  { id: 'medium', label: 'P2' }
]
const STATUS = ['all', 'firing', 'acknowledged', 'resolved']

const alerts = computed(() =>
  m.rawState.alerts.filter((a) => {
    if (sevFilter.value !== 'all' && a.sev_level !== sevFilter.value) return false
    if (statusFilter.value !== 'all' && a.status !== statusFilter.value) return false
    return true
  })
)
const counts = computed(() => {
  const a = m.rawState.alerts
  return {
    p0: a.filter((x) => x.sev_level === 'critical' && x.status === 'firing').length,
    p1: a.filter((x) => x.sev_level === 'high' && x.status === 'firing').length,
    firing: a.filter((x) => x.status === 'firing').length,
    recurring: a.filter((x) => x.recurring).length
  }
})

const sevMeta = {
  critical: { label: 'P0', color: '#ff5f6d', bg: 'bg-cyber-red/12' },
  high: { label: 'P1', color: '#ffb648', bg: 'bg-cyber-amber/12' },
  medium: { label: 'P2', color: '#38e1ff', bg: 'bg-cyber-cyan/12' },
  low: { label: 'P3', color: '#9aa7ba', bg: 'bg-cyber-text-3/12' }
}
const statusMeta = {
  firing: 'text-cyber-red', acknowledged: 'text-cyber-amber', resolved: 'text-cyber-green', silenced: 'text-cyber-text-3'
}
function ack(a) { a.status = a.status === 'acknowledged' ? 'firing' : 'acknowledged' }
</script>

<template>
  <div class="space-y-4">
    <header class="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">Alert Events</h2>
        <p class="text-[14px] text-steel mt-0.5">Discover, acknowledge, localize and close out compute alerts.</p>
      </div>
      <div class="flex gap-2">
        <Stat label="P0 firing" :value="counts.p0" color="#ff5f6d" />
        <Stat label="P1 firing" :value="counts.p1" color="#ffb648" />
        <Stat label="Recurring" :value="counts.recurring" color="#8b7bff" />
      </div>
    </header>

    <!-- filters -->
    <div class="flex items-center gap-2 flex-wrap">
      <button v-for="s in SEV" :key="s.id" class="nz-pill" :class="sevFilter === s.id ? 'nz-pill-active' : ''" @click="sevFilter = s.id">{{ s.label }}</button>
      <div class="h-5 w-px bg-hairline mx-1" />
      <button v-for="s in STATUS" :key="s" class="nz-pill capitalize" :class="statusFilter === s ? 'nz-pill-active' : ''" @click="statusFilter = s">{{ s }}</button>
    </div>

    <!-- alert list -->
    <section class="cy-panel overflow-hidden">
      <div v-for="a in alerts" :key="a.alert_id"
        class="flex items-center gap-4 px-5 py-3.5 border-b border-cyber-line-soft hover:bg-cyber-panel-2 transition-colors">
        <span class="px-2 h-6 grid place-items-center rounded-md text-[11px] font-bold cy-readout shrink-0" :class="sevMeta[a.sev_level].bg" :style="{ color: sevMeta[a.sev_level].color }">
          {{ sevMeta[a.sev_level].label }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-[13.5px] font-semibold text-cyber-text">{{ a.name }}</span>
            <span v-if="a.recurring" class="inline-flex items-center gap-0.5 text-[10.5px] text-cyber-violet"><Repeat :size="11" />recurring</span>
          </div>
          <div class="text-[12px] text-cyber-text-2 font-mono truncate">{{ a.resource }}</div>
        </div>
        <div class="hidden md:block text-right shrink-0 w-40">
          <div class="cy-readout text-[12.5px] text-cyber-text">{{ a.current }}</div>
          <div class="text-[11px] text-cyber-text-3 font-mono truncate">{{ a.threshold }}</div>
        </div>
        <div class="hidden lg:block text-[11.5px] text-cyber-text-3 cy-readout w-24 text-right shrink-0">
          {{ a.first_seen_min }}m → {{ a.last_seen_min }}m
        </div>
        <span class="text-[12px] font-medium capitalize w-24 text-right shrink-0" :class="statusMeta[a.status]">{{ a.status }}</span>
        <div class="flex gap-1 shrink-0">
          <button class="alert-act" :class="a.status==='acknowledged' ? 'text-cyber-amber border-cyber-amber/40' : ''" title="Acknowledge" @click="ack(a)"><Check :size="14" /></button>
          <button class="alert-act" title="Silence"><BellOff :size="14" /></button>
        </div>
      </div>
      <p v-if="!alerts.length" class="px-5 py-10 text-center text-[13px] text-cyber-text-3">No alerts match the current filters.</p>
    </section>

    <!-- suggested actions hint -->
    <p class="px-1 text-[12.5px] text-steel">
      Inhibition active: offline-card alerts suppress derived low-util / missing-temperature alerts for the same card.
    </p>
  </div>
</template>

<script>
import { h } from 'vue'
const Stat = (props) =>
  h('div', { class: 'rounded-lg border border-hairline bg-surface px-3 py-1.5 text-center min-w-[88px]' }, [
    h('div', { class: 'micro-label text-stone' }, props.label),
    h('div', { class: 'cy-readout text-[20px] font-semibold mt-0.5', style: { color: props.color } }, String(props.value))
  ])
Stat.props = ['label', 'value', 'color']
export default { components: { Stat } }
</script>

<style scoped>
.alert-act {
  height: 30px; width: 30px; border-radius: 8px; display: grid; place-items: center;
  border: 1px solid #232b39; color: #9aa7ba; transition: all 0.12s;
}
.alert-act:hover { background: #1b222e; color: #e6edf6; }
</style>
