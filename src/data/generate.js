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
    const cards = Math.floor(between(8, 256))
    const tokens = Math.floor(between(2400, 18000))
    const OPS = ['flash_attn_fwd', 'flash_attn_bwd', 'matmul_qkv', 'all_reduce', 'layernorm', 'gelu_act', 'adam_step']
    const opTop = OPS.map((o) => ({ name: o, ms: +between(0.4, 9).toFixed(2) })).sort((a, b) => b.ms - a.ms).slice(0, 5)
    jobs.push({
      job_id: `job-${(++_jobId).toString().padStart(3, '0')}`,
      job_name: JOB_NAMES[i],
      framework: pick(FRAMEWORKS),
      parallel_strategy: pick(PARALLEL),
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.name,
      region_id: region.region_id,
      status,
      cards,
      tokens_per_s: tokens,
      samples_per_s: Math.round(tokens / between(900, 2200)),
      per_card_tokens: Math.round(tokens / cards),
      mfu_pct: +mfu.toFixed(1),
      achieved_tflops: Math.round((mfu / 100) * 989),
      goodput_pct: +clamp(between(72, 97) - (mfu < 30 ? 16 : 0), 40, 99).toFixed(1),
      step_p50_ms: Math.round(stepP50),
      step_p95_ms: Math.round(stepP50 * between(1.15, 1.6)),
      step_p99_ms: Math.round(stepP50 * between(1.5, 2.2)),
      comm_wait_pct: +commWait.toFixed(1),
      data_wait_pct: +dataWait.toFixed(1),
      comm_bw_eff_pct: +clamp(between(45, 88) - (commWait > 25 ? 20 : 0), 20, 95).toFixed(1),
      idle_pct: +clamp(commWait + dataWait + between(2, 8), 2, 60).toFixed(1),
      sm_occupancy_pct: +clamp(mfu * between(1.1, 1.6), 20, 88).toFixed(1),
      prefetch_q: Math.floor(between(0, 8)),
      h2d_ms: +between(0.5, 6).toFixed(1),
      ckpt_save_s: Math.round(between(6, 40)),
      ckpt_size_gb: +between(2, 48).toFixed(1),
      ckpt_write_bw: +between(0.8, 6).toFixed(1),
      ckpt_async_q: Math.floor(between(0, 4)),
      ckpt_failures: rnd() > 0.9 ? Math.floor(between(1, 2)) : 0,
      nan_inf_events: rnd() > 0.92 ? Math.floor(between(1, 3)) : 0,
      loss_spikes: rnd() > 0.7 ? Math.floor(between(1, 4)) : 0,
      grad_anomalies: rnd() > 0.85 ? Math.floor(between(1, 2)) : 0,
      lr_anomalies: rnd() > 0.9 ? 1 : 0,
      cache_miss_pct: +between(2, 18).toFixed(1),
      ipc: +between(0.6, 2.4).toFixed(2),
      nccl_algo: pick(['Ring', 'Tree', 'NVLS']),
      ebpf_tcp_retx: Math.floor(between(0, 40)),
      mem_frag_pct: +between(3, 28).toFixed(1),
      operators_top: opTop,
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
        const powerLimitHit = power > meta.power_limit_w * 0.95 ? between(6, 42) : between(0, 4)
        const idle = allocated ? clamp(100 - util * between(0.95, 1.08), 1, 96) : 100
        const tflops = +((mfu / 100) * meta.peak_tflops).toFixed(0)
        const linkErr = meta.vendor === 'nvidia' && (health === 'critical' || rnd() > 0.94) ? Math.floor(between(1, 6)) : 0
        const ppuErr = meta.vendor === 'aliyun_ppu' && health === 'critical' ? Math.floor(between(1, 4)) : 0
        const cooling = temp > 88 ? 'fault' : temp > 80 ? 'degraded' : 'ok'
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
          peak_tflops: meta.peak_tflops,
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
          idle_pct: +idle.toFixed(1),
          achieved_tflops: tflops,
          power_limit_hit_pct: +powerLimitHit.toFixed(1),
          link_errors: linkErr,
          ppu_err: ppuErr,
          cooling_state: cooling,
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

// Per-node system + network + Kubernetes metrics (aggregated from accelerators).
function buildNodes(accelerators) {
  const byNode = {}
  for (const a of accelerators) (byNode[a.node_id] ||= []).push(a)
  return Object.entries(byNode).map(([node_id, cards]) => {
    const c0 = cards[0]
    const offline = cards.some((c) => c.offline)
    const critical = cards.some((c) => c.health_status === 'critical')
    const health = offline || critical ? 'critical' : cards.some((c) => c.health_status === 'warning') ? 'warning' : 'healthy'
    const iowait = between(1, 14)
    return {
      node_id,
      region_id: c0.region_id,
      region_name: c0.region_name,
      cluster_id: c0.cluster_id,
      model_label: c0.model_label,
      card_count: cards.length,
      health,
      // system
      cpu_pct: +between(18, 82).toFixed(1),
      iowait_pct: +iowait.toFixed(1),
      mem_pct: +between(35, 92).toFixed(1),
      numa_imbalance: +between(1.0, 1.9).toFixed(2),
      oom_kills: critical || rnd() > 0.9 ? Math.floor(between(1, 3)) : 0,
      // network
      nvlink_bw_gbs: +between(180, 880).toFixed(0),
      fabric_bw_gbps: +between(60, 390).toFixed(0),
      pfc_ecn: rnd() > 0.6 ? Math.floor(between(1, 240)) : 0,
      port_down: offline || rnd() > 0.93 ? Math.floor(between(1, 2)) : 0,
      bit_errors: rnd() > 0.7 ? Math.floor(between(1, 60)) : 0,
      net_p99_us: +between(6, 95).toFixed(0),
      link_status: offline ? 'down' : rnd() > 0.88 ? 'degraded' : 'up',
      // kubernetes
      pending_p95_s: Math.floor(between(0, 220)),
      schedule_failures: rnd() > 0.85 ? Math.floor(between(1, 6)) : 0,
      pod_restarts: rnd() > 0.7 ? Math.floor(between(1, 5)) : 0,
      exit_code: rnd() > 0.8 ? pick([0, 1, 137, 143]) : 0,
      req_limit_ratio: +between(0.55, 0.98).toFixed(2)
    }
  })
}

export function tickNodes(nodes) {
  for (const n of nodes) {
    const d = (v, lo, hi, amp) => +clamp(v + between(-amp, amp), lo, hi).toFixed(1)
    n.cpu_pct = d(n.cpu_pct, 10, 95, 4)
    n.iowait_pct = d(n.iowait_pct, 0, 30, 1.5)
    n.mem_pct = d(n.mem_pct, 20, 96, 2)
    n.fabric_bw_gbps = Math.round(d(n.fabric_bw_gbps, 40, 400, 18))
    n.nvlink_bw_gbs = Math.round(d(n.nvlink_bw_gbs, 120, 900, 30))
    n.net_p99_us = Math.round(d(n.net_p99_us, 5, 120, 4))
  }
  return nodes
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

function buildAlerts(accelerators, jobs, nodes = []) {
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
    if (j.nan_inf_events > 0) add('P0', 'NaNInfDetected', `${j.job_name}`, `${j.nan_inf_events} NaN/Inf`, 'nan_inf_increase > 0', 'Roll back to checkpoint')
  }
  for (const n of nodes) {
    if (n.port_down > 0) add('P0', 'NetworkPortDown', `${n.node_id}`, `${n.port_down} port down`, 'port_down > 0', 'Check NIC / optics')
    if (n.oom_kills > 0) add('P1', 'OOMKill', `${n.node_id}`, `${n.oom_kills} OOM`, 'oom_kill_increase > 0', 'Right-size pod memory')
    if (n.schedule_failures > 2) add('P2', 'SchedulingFailures', `${n.node_id}`, `${n.schedule_failures} fails`, 'schedule_failures > 2', 'Inspect quota / topology')
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
  const nodes = buildNodes(accelerators)
  const alerts = buildAlerts(accelerators, jobs, nodes)
  return { jobs, accelerators, alerts, nodes }
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
      a.idle_pct = +clamp(100 - a.util_pct * between(0.95, 1.08), 1, 96).toFixed(1)
      a.achieved_tflops = Math.round((a.mfu_pct / 100) * (a.peak_tflops || 1979))
    }
    a.temp_c = Math.round(drift(a.temp_c, 32, 96, 1.4))
    a.power_w = Math.round(drift(a.power_w, 25, a.power_limit_w, 18))
    a.power_limit_hit_pct = +(a.power_w > a.power_limit_w * 0.95 ? between(6, 42) : between(0, 4)).toFixed(1)
    a.thermal_throttle = a.temp_c > 86
    a.cooling_state = a.temp_c > 88 ? 'fault' : a.temp_c > 80 ? 'degraded' : 'ok'
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
