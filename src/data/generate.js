// Deterministic fleet generator + live jitter utilities.
// Produces a realistic mock fleet of accelerators, jobs, alerts and cost data.

import { REGIONS, ACCELERATOR_TYPES, TENANTS, FRAMEWORKS, PARALLEL } from './catalog.js'

// ── Tiny seeded PRNG (mulberry32) for stable base fleet ──
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260609)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + rnd() * (b - a)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Distribute models across regions with a realistic mix
const REGION_MODEL_MIX = {
  'cn-hangzhou': ['H200', 'H200', 'ZHENWU_810E', 'ZHENWU_M890'],
  'cn-wulanchabu': ['H200', 'H200', 'H200', 'ZHENWU_M890'],
  'cn-shenzhen': ['ZHENWU_810E', 'ZHENWU_810E', 'RTX_PRO_5000_BLACKWELL'],
  'us-west-2': ['H200', 'RTX_PRO_5000_BLACKWELL']
}

const JOB_NAMES = [
  'qwen-pretrain-stage3', 'llava-vlm-sft', 'moe-256e-pretrain', 'reward-model-v4',
  'code-llm-midtrain', 'longctx-128k-cont', 'dpo-align-run7', 'vision-encoder-distill',
  'audio-lm-pretrain', 'router-balance-exp', 'sft-multilingual-22', 'embedding-v3-train'
]

let _accId = 0
let _jobId = 0
let _alertId = 0

function modelMeta(model) {
  return ACCELERATOR_TYPES.find((t) => t.model === model)
}

// Build jobs first so accelerators can bind to them
function buildJobs() {
  const jobs = []
  for (let i = 0; i < JOB_NAMES.length; i++) {
    const tenant = pick(TENANTS)
    const region = pick(REGIONS)
    const status = rnd() < 0.78 ? 'running' : rnd() < 0.5 ? 'queued' : 'completed'
    const mfu = clamp(between(28, 61) - (rnd() < 0.25 ? 18 : 0), 8, 64)
    const commWait = clamp(between(6, 22) + (mfu < 30 ? 14 : 0), 2, 48)
    const dataWait = clamp(between(4, 16) + (rnd() < 0.2 ? 18 : 0), 1, 40)
    const stepP50 = between(420, 1400)
    jobs.push({
      job_id: `job-${(++_jobId).toString().padStart(3, '0')}`,
      job_name: JOB_NAMES[i],
      framework: pick(FRAMEWORKS),
      parallel_strategy: pick(PARALLEL),
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.name,
      region_id: region.region_id,
      status,
      cards: Math.floor(between(8, 256)),
      tokens_per_s: Math.floor(between(2400, 18000)),
      mfu_pct: +mfu.toFixed(1),
      goodput_pct: +clamp(between(72, 97) - (mfu < 30 ? 16 : 0), 40, 99).toFixed(1),
      step_p50_ms: Math.round(stepP50),
      step_p95_ms: Math.round(stepP50 * between(1.15, 1.6)),
      step_p99_ms: Math.round(stepP50 * between(1.5, 2.2)),
      comm_wait_pct: +commWait.toFixed(1),
      data_wait_pct: +dataWait.toFixed(1),
      card_hours: Math.floor(between(120, 9800)),
      cost_per_mtok: +between(0.8, 4.2).toFixed(2),
      started_min_ago: Math.floor(between(20, 4200))
    })
  }
  return jobs
}

function buildAccelerators(jobs) {
  const accelerators = []
  const runningJobs = jobs.filter((j) => j.status === 'running')
  for (const region of REGIONS) {
    const models = REGION_MODEL_MIX[region.region_id]
    const nodeCount = region.region_id === 'cn-shenzhen' ? 5 : region.region_id === 'us-west-2' ? 4 : 8
    for (let n = 0; n < nodeCount; n++) {
      const nodeId = `${region.region_id}-node${(n + 1).toString().padStart(2, '0')}`
      const model = models[n % models.length]
      const meta = modelMeta(model)
      const cardsPerNode = model.startsWith('ZHENWU') ? 8 : meta.model === 'RTX_PRO_5000_BLACKWELL' ? 4 : 8
      for (let d = 0; d < cardsPerNode; d++) {
        const roll = rnd()
        let health = 'healthy'
        if (roll > 0.965) health = 'critical'
        else if (roll > 0.9) health = 'warning'
        else if (roll > 0.885) health = 'offline'
        const allocated = health === 'offline' ? false : rnd() < 0.82
        const job = allocated ? pick(runningJobs) : null
        // utilization: allocated-but-idle cases create the "waste" signal
        let util = 0
        if (allocated) util = rnd() < 0.18 ? between(2, 18) : between(48, 96)
        const memUsed = allocated ? clamp(util > 30 ? between(55, 94) : between(30, 88), 5, 98) : between(0, 4)
        const tempBase = meta.power_limit_w > 500 ? 64 : 52
        const temp = clamp(tempBase + util * 0.28 + (health === 'critical' ? 20 : 0) + between(-3, 5), 30, 96)
        const power = clamp((util / 100) * meta.power_limit_w * between(0.85, 1.02) + between(20, 60), 25, meta.power_limit_w)
        const xid = health === 'critical' && meta.vendor === 'nvidia' ? Math.floor(between(1, 4)) : 0
        const ecc = health === 'critical' ? Math.floor(between(0, 2)) : 0
        // efficiency metrics (tensor util ≤ compute util; MFU lower still; SM occupancy)
        const active = allocated && util > 25
        const tensor = allocated ? clamp(util * between(0.6, 0.92), 0, 99) : 0
        const sm = active ? between(34, 82) : (allocated ? between(8, 24) : between(1, 6))
        const mfu = active ? clamp(util * between(0.45, 0.72), 8, 65) : (allocated ? between(2, 10) : 0)
        accelerators.push({
          accelerator_id: `acc-${(++_accId).toString().padStart(4, '0')}`,
          uuid: `GPU-${Math.floor(between(1e6, 9e6)).toString(16)}`,
          region_id: region.region_id,
          region_name: region.region_name,
          cluster_id: `${region.region_id}-train-a`,
          node_id: nodeId,
          device_index: d,
          vendor: meta.vendor,
          model: meta.model,
          model_label: meta.label,
          accent: meta.accent,
          memory_total_gb: meta.memory_total_gb,
          power_limit_w: meta.power_limit_w,
          health_status: health,
          allocated,
          job_id: job?.job_id || null,
          job_name: job?.job_name || null,
          tenant_id: job?.tenant_id || null,
          util_pct: +util.toFixed(1),
          mem_pct: +memUsed.toFixed(1),
          mem_bw_pct: +clamp(util * between(0.7, 1.1), 0, 99).toFixed(1),
          tensor_pct: +tensor.toFixed(1),
          sm_occupancy_pct: +sm.toFixed(1),
          mfu_pct: +mfu.toFixed(1),
          temp_c: +temp.toFixed(0),
          power_w: +power.toFixed(0),
          xid_errors: xid,
          ecc_errors: ecc,
          offline: health === 'offline',
          thermal_throttle: temp > 86,
          source_status: rnd() < 0.94 ? 'healthy' : rnd() < 0.5 ? 'stale' : 'missing',
          spark: makeSpark(util, 24)
        })
      }
    }
  }
  return accelerators
}

function makeSpark(center, n) {
  const out = []
  let v = center
  for (let i = 0; i < n; i++) {
    v = clamp(v + between(-9, 9), 0, 100)
    out.push(+v.toFixed(1))
  }
  return out
}

function buildAlerts(accelerators, jobs) {
  const alerts = []
  const sev = (s) => ({ P0: 'critical', P1: 'high', P2: 'medium', P3: 'low' }[s])
  const add = (severity, name, resource, current, threshold, suggested, status = 'firing') => {
    const firstMin = Math.floor(between(2, 600))
    alerts.push({
      alert_id: `alert-${(++_alertId).toString().padStart(3, '0')}`,
      severity, sev_level: sev(severity), name, resource,
      current, threshold, suggested, status,
      first_seen_min: firstMin,
      last_seen_min: Math.floor(between(0, Math.min(firstMin, 30))),
      recurring: rnd() < 0.22
    })
  }
  for (const a of accelerators) {
    if (a.offline) add('P0', 'AcceleratorOffline', `${a.node_id} · dev${a.device_index}`, 'device offline', 'offline_events > 0', 'Isolate node, open hardware ticket')
    else if (a.xid_errors > 0) add('P0', 'XidError', `${a.node_id} · dev${a.device_index}`, `${a.xid_errors} Xid`, 'xid_increase > 0', 'Drain card, inspect Xid code')
    else if (a.ecc_errors > 0) add('P0', 'EccUncorrectable', `${a.node_id} · dev${a.device_index}`, `${a.ecc_errors} ECC`, 'ecc_uncorrectable > 0', 'Retire card from pool')
    else if (a.thermal_throttle) add('P1', 'ThermalThrottle', `${a.node_id} · dev${a.device_index}`, `${a.temp_c}°C`, 'throttle_events > 0 FOR 5m', 'Check cooling / airflow')
    else if (a.allocated && a.util_pct < 20) add('P1', 'LowUtilizationAllocated', `${a.node_id} · dev${a.device_index}`, `${a.util_pct}% util`, 'compute < 20% FOR 30m', 'Contact tenant, reclaim card')
  }
  for (const j of jobs) {
    if (j.comm_wait_pct > 30) add('P1', 'CommunicationWaitHigh', `${j.job_name}`, `${j.comm_wait_pct}% comm wait`, 'comm_wait > 30% FOR 10m', 'Inspect NCCL / fabric')
    if (j.data_wait_pct > 25) add('P1', 'DataLoaderStall', `${j.job_name}`, `${j.data_wait_pct}% data wait`, 'data_wait > 25% FOR 10m', 'Scale DataLoader workers')
    if (j.cost_per_mtok > 3.4) add('P2', 'CostPerTokenHigh', `${j.job_name}`, `$${j.cost_per_mtok}/Mtok`, 'cost > baseline*1.3', 'Review parallel strategy')
  }
  // a couple resolved/acked examples
  if (alerts[2]) alerts[2].status = 'acknowledged'
  if (alerts[5]) alerts[5].status = 'resolved'
  return alerts.sort((a, b) => a.sev_level === b.sev_level ? a.first_seen_min - b.first_seen_min : sevRank(a.sev_level) - sevRank(b.sev_level))
}
function sevRank(s) { return { critical: 0, high: 1, medium: 2, low: 3 }[s] }

export function buildFleet() {
  const jobs = buildJobs()
  const accelerators = buildAccelerators(jobs)
  const alerts = buildAlerts(accelerators, jobs)
  return { jobs, accelerators, alerts }
}

// ── Live jitter: nudge dynamic fields a little on each tick ──
export function tickFleet(accelerators) {
  for (const a of accelerators) {
    if (a.offline) continue
    const drift = (v, lo, hi, amp) => clamp(v + between(-amp, amp), lo, hi)
    if (a.allocated) {
      a.util_pct = +drift(a.util_pct, a.util_pct < 20 ? 1 : 35, a.util_pct < 20 ? 22 : 98, 3.5).toFixed(1)
      a.mem_pct = +drift(a.mem_pct, 4, 98, 1.8).toFixed(1)
      a.mem_bw_pct = +clamp(a.util_pct * between(0.7, 1.05), 0, 99).toFixed(1)
      a.tensor_pct = +clamp(a.util_pct * between(0.6, 0.92), 0, 99).toFixed(1)
      const act = a.util_pct > 25
      a.sm_occupancy_pct = +drift(a.sm_occupancy_pct, act ? 30 : 4, act ? 86 : 26, 2.4).toFixed(1)
      a.mfu_pct = +clamp(a.util_pct * between(0.45, 0.72), act ? 8 : 1, 65).toFixed(1)
    }
    a.temp_c = Math.round(drift(a.temp_c, 32, 96, 1.4))
    a.power_w = Math.round(drift(a.power_w, 25, a.power_limit_w, 18))
    a.thermal_throttle = a.temp_c > 86
    a.spark = [...a.spark.slice(1), a.util_pct]
  }
  return accelerators
}

// ── Time-series generator for charts (deterministic per key + live tail) ──
export function makeSeries(points, center, amplitude, key = 0, trend = 0) {
  const r = mulberry32(1000 + key)
  const out = []
  let v = center
  for (let i = 0; i < points; i++) {
    v = clamp(v + (r() - 0.5) * amplitude + trend, 2, 100)
    out.push(+v.toFixed(1))
  }
  return out
}

export const round = (v, d = 0) => +Number(v).toFixed(d)
export { clamp }
