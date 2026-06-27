// Central reactive store. Simulates the PRD monitoring API surface (§12.4)
// over an in-memory mock fleet, with global filters, derived aggregates and
// a live refresh loop.

import { reactive, computed, readonly } from 'vue'
import { REGIONS, ACCELERATOR_TYPES, TENANTS, TIME_RANGES } from '../data/catalog.js'
import { buildFleet, tickFleet, clamp } from '../data/generate.js'

const fleet = buildFleet()

const state = reactive({
  activeTab: 'overview',
  timeRange: '6h',
  live: true,
  lastRefresh: Date.now(),
  refreshing: false,
  dataStatus: 'complete', // complete | partial | stale
  filters: {
    region_ids: [],
    accelerator_models: [],
    tenant_ids: [],
    health_status: []
  },
  preset: null, // active metric-value preset id
  jobs: fleet.jobs,
  accelerators: fleet.accelerators,
  alerts: fleet.alerts,
  drawer: null // { type: 'accelerator'|'job', id }
})

// ── Filtering ──
function matchAccelerator(a) {
  const f = state.filters
  if (f.region_ids.length && !f.region_ids.includes(a.region_id)) return false
  if (f.accelerator_models.length && !f.accelerator_models.includes(a.model)) return false
  if (f.tenant_ids.length && !f.tenant_ids.includes(a.tenant_id)) return false
  if (f.health_status.length && !f.health_status.includes(a.health_status)) return false
  if (state.preset === 'low_util' && !(a.allocated && a.util_pct < 20)) return false
  if (state.preset === 'hi_mem_lo_compute' && !(a.mem_pct > 80 && a.util_pct < 30)) return false
  if (state.preset === 'thermal' && !a.thermal_throttle) return false
  if (state.preset === 'hw_risk' && !(a.xid_errors > 0 || a.ecc_errors > 0 || a.offline)) return false
  return true
}

const filteredAccelerators = computed(() => state.accelerators.filter(matchAccelerator))

const filteredJobs = computed(() => {
  const f = state.filters
  return state.jobs.filter((j) => {
    if (f.region_ids.length && !f.region_ids.includes(j.region_id)) return false
    if (f.tenant_ids.length && !f.tenant_ids.includes(j.tenant_id)) return false
    return true
  })
})

// ── Derived: Overview KPIs (§7.2) ──
const kpis = computed(() => {
  const accs = filteredAccelerators.value
  const total = accs.length || 1
  const healthy = accs.filter((a) => a.health_status === 'healthy').length
  const unavailable = accs.filter((a) => a.offline || a.health_status === 'critical').length
  const allocated = accs.filter((a) => a.allocated).length
  const active = accs.filter((a) => a.allocated && a.util_pct > 25).length
  const sumUtil = accs.reduce((s, a) => s + (a.allocated ? a.util_pct : 0), 0)
  const sumMem = accs.reduce((s, a) => s + a.mem_pct * a.memory_total_gb, 0)
  const memCap = accs.reduce((s, a) => s + a.memory_total_gb, 0) || 1
  const p0 = state.alerts.filter((al) => al.sev_level === 'critical' && al.status === 'firing').length
  const hwErr = accs.reduce((s, a) => s + a.xid_errors + a.ecc_errors + (a.offline ? 1 : 0), 0)
  const thermal = accs.filter((a) => a.thermal_throttle).length
  const throughput = filteredJobs.value
    .filter((j) => j.status === 'running')
    .reduce((s, j) => s + j.tokens_per_s, 0)
  const idleCards = accs.filter((a) => !a.allocated || a.util_pct < 20).length
  const allocatedCards = accs.filter((a) => a.allocated)
  const activeCards = accs.filter((a) => a.allocated && a.util_pct > 25)
  const avg = (arr, key) => (arr.length ? arr.reduce((s, a) => s + a[key], 0) / arr.length : 0)
  return {
    total: accs.length,
    healthy,
    availability_pct: +((healthy / total) * 100).toFixed(1),
    unavailable,
    allocated,
    allocation_pct: +((allocated / total) * 100).toFixed(1),
    active,
    avg_util: +(sumUtil / (allocated || 1)).toFixed(1),
    avg_mem: +(sumMem / memCap).toFixed(1),
    avg_sm: +avg(allocatedCards, 'sm_occupancy_pct').toFixed(1),
    avg_mfu: +avg(activeCards, 'mfu_pct').toFixed(1),
    avg_tensor: +avg(allocatedCards, 'tensor_pct').toFixed(1),
    p0,
    hw_err: hwErr,
    thermal,
    throughput,
    idle_card_hours: Math.round(idleCards * 6.0),
    waste_cost: Math.round(idleCards * 6.0 * 2.6)
  }
})

// ── Derived: Region × Model matrix (§11.1.3) ──
const regionModelMatrix = computed(() => {
  const models = ACCELERATOR_TYPES
  const rows = REGIONS.map((r) => {
    const cells = models.map((m) => {
      const cards = filteredAccelerators.value.filter((a) => a.region_id === r.region_id && a.model === m.model)
      if (!cards.length) return { model: m.model, empty: true }
      const healthy = cards.filter((c) => c.health_status === 'healthy').length
      const avgUtil = cards.reduce((s, c) => s + (c.allocated ? c.util_pct : 0), 0) / cards.length
      const p0 = cards.filter((c) => c.offline || c.xid_errors > 0 || c.ecc_errors > 0).length
      return {
        model: m.model,
        empty: false,
        count: cards.length,
        health_pct: +((healthy / cards.length) * 100).toFixed(0),
        avg_util: +avgUtil.toFixed(0),
        p0,
        region_id: r.region_id
      }
    })
    return { region: r, cells }
  })
  return { models, rows }
})

// ── Derived: Tenant × Model matrix ──
const tenantModelMatrix = computed(() => {
  const models = ACCELERATOR_TYPES
  const rows = TENANTS.map((t) => {
    const cells = models.map((m) => {
      const cards = filteredAccelerators.value.filter((a) => a.tenant_id === t.tenant_id && a.model === m.model)
      if (!cards.length) return { model: m.model, empty: true }
      const healthy = cards.filter((c) => c.health_status === 'healthy').length
      const avgUtil = cards.reduce((s, c) => s + (c.allocated ? c.util_pct : 0), 0) / cards.length
      const p0 = cards.filter((c) => c.offline || c.xid_errors > 0 || c.ecc_errors > 0).length
      return {
        model: m.model,
        empty: false,
        count: cards.length,
        health_pct: +((healthy / cards.length) * 100).toFixed(0),
        avg_util: +avgUtil.toFixed(0),
        p0,
        tenant_id: t.tenant_id
      }
    })
    return { tenant: t, cells }
  })
  return { models, rows }
})

// ── Derived: TopN (§11.1.3) ──
const topN = computed(() => {
  const accs = filteredAccelerators.value
  const abnormal = [...accs]
    .filter((a) => a.health_status !== 'healthy')
    .sort((a, b) => (b.xid_errors + b.ecc_errors + (b.offline ? 5 : 0) + b.temp_c / 50) - (a.xid_errors + a.ecc_errors + (a.offline ? 5 : 0) + a.temp_c / 50))
    .slice(0, 8)
  const lowUtil = [...accs]
    .filter((a) => a.allocated)
    .sort((a, b) => a.util_pct - b.util_pct)
    .slice(0, 8)
  const slowJobs = [...filteredJobs.value]
    .filter((j) => j.status === 'running')
    .sort((a, b) => (b.comm_wait_pct + b.data_wait_pct) - (a.comm_wait_pct + a.data_wait_pct))
    .slice(0, 8)
  const cost = [...filteredJobs.value]
    .sort((a, b) => b.cost_per_mtok - a.cost_per_mtok)
    .slice(0, 8)
  return { abnormal, lowUtil, slowJobs, cost }
})

// ── Derived: event timeline ──
const timeline = computed(() => {
  const events = []
  for (const al of state.alerts.slice(0, 12)) {
    events.push({
      id: al.alert_id,
      min_ago: al.last_seen_min,
      kind: al.sev_level === 'critical' ? 'hardware' : 'alert',
      severity: al.sev_level,
      title: al.name,
      detail: `${al.resource} · ${al.current}`
    })
  }
  return events.sort((a, b) => a.min_ago - b.min_ago)
})

// ── Derived: cost & capacity ──
const costSummary = computed(() => {
  const accs = filteredAccelerators.value
  const cardHours = accs.length * 6
  const allocatedHours = accs.filter((a) => a.allocated).length * 6
  const activeHours = accs.filter((a) => a.allocated && a.util_pct > 25).length * 6
  const idleHours = cardHours - allocatedHours
  const lowUtilHours = accs.filter((a) => a.allocated && a.util_pct < 20).length * 6
  const goodput = +(activeHours / (allocatedHours || 1) * 100).toFixed(1)
  return {
    card_hours: cardHours,
    allocated_hours: allocatedHours,
    active_hours: activeHours,
    idle_hours: idleHours,
    low_util_hours: lowUtilHours,
    waste_cost: Math.round((idleHours + lowUtilHours) * 2.6),
    goodput,
    queue_p50: 4,
    queue_p95: 27,
    queue_depth: 18,
    fragmentation_pct: 11.4,
    watermark_pct: 83
  }
})

const counts = computed(() => ({
  alerts: state.alerts.filter((a) => a.status === 'firing').length,
  p0: state.alerts.filter((a) => a.sev_level === 'critical' && a.status === 'firing').length
}))

// ── Actions ──
function setTab(id) { state.activeTab = id }
function setTimeRange(id) { state.timeRange = id; refresh() }
function toggleLive() { state.live = !state.live }

function toggleFilter(key, value) {
  const arr = state.filters[key]
  const i = arr.indexOf(value)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(value)
  state.lastRefresh = Date.now()
}
function setPreset(id) { state.preset = state.preset === id ? null : id }
function resetFilters() {
  state.filters = { region_ids: [], accelerator_models: [], tenant_ids: [], health_status: [] }
  state.preset = null
}
function openDrawer(type, id) { state.drawer = { type, id } }
function closeDrawer() { state.drawer = null }

function refresh() {
  state.refreshing = true
  setTimeout(() => {
    tickFleet(state.accelerators)
    state.lastRefresh = Date.now()
    state.refreshing = false
    // randomly surface partial/stale state on shenzhen (degraded region)
    state.dataStatus = Math.random() < 0.12 ? 'partial' : 'complete'
  }, 280)
}

let timer = null
function startLive() {
  stopLive()
  timer = setInterval(() => { if (state.live) { tickFleet(state.accelerators); state.lastRefresh = Date.now() } }, 4000)
}
function stopLive() { if (timer) clearInterval(timer) }

export function useMonitor() {
  return {
    state: readonly(state),
    rawState: state,
    REGIONS, ACCELERATOR_TYPES, TENANTS, TIME_RANGES,
    filteredAccelerators, filteredJobs,
    kpis, regionModelMatrix, tenantModelMatrix, topN, timeline, costSummary, counts,
    setTab, setTimeRange, toggleLive, toggleFilter, setPreset, resetFilters,
    openDrawer, closeDrawer, refresh, startLive, stopLive,
    clamp
  }
}
