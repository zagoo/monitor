// Per-job derived analytics: step-time breakdown + accelerator skew matrix (PRD §11.3).

function seedFrom(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0)
}
function rngFrom(seed) {
  let s = seed
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function stepBreakdown(job) {
  // Communication + data wait come from the job; remainder split across compute phases.
  const comm = job.comm_wait_pct
  const data = job.data_wait_pct
  const r = rngFrom(seedFrom(job.job_id))
  const remaining = Math.max(20, 100 - comm - data - 6)
  const fwd = remaining * (0.34 + r() * 0.06)
  const bwd = remaining * (0.40 + r() * 0.06)
  const opt = remaining * 0.12
  const ckpt = 3 + r() * 3
  const idle = Math.max(0, 100 - comm - data - fwd - bwd - opt - ckpt)
  const parts = [
    { name: 'Forward', pct: fwd, color: '#38e1ff' },
    { name: 'Backward', pct: bwd, color: '#5aa9ff' },
    { name: 'Optimizer', pct: opt, color: '#8b7bff' },
    { name: 'Communication', pct: comm, color: '#ff5f6d' },
    { name: 'Data Loading', pct: data, color: '#ffb648' },
    { name: 'Checkpoint', pct: ckpt, color: '#9cff57' },
    { name: 'Idle / Barrier', pct: idle, color: '#5e6b7e' }
  ]
  const total = parts.reduce((s, p) => s + p.pct, 0)
  return parts.map((p) => ({ ...p, pct: +(p.pct / total * 100).toFixed(1) }))
}

export function skewMatrix(job) {
  const r = rngFrom(seedFrom(job.job_id + 'skew'))
  const nodeCount = Math.min(8, Math.max(2, Math.round(job.cards / 8)))
  const cols = 8
  const rows = []
  for (let n = 0; n < nodeCount; n++) {
    const cells = []
    for (let d = 0; d < cols; d++) {
      // most cards normal, a few stragglers
      let dev = Math.round(r() * 8)
      if (r() > 0.9) dev = Math.round(12 + r() * 45)
      else if (r() > 0.78) dev = Math.round(10 + r() * 10)
      const level = dev > 50 ? 'severe' : dev > 20 ? 'obvious' : dev > 10 ? 'slight' : 'normal'
      cells.push({ dev, level })
    }
    rows.push({ node: `node${(n + 1).toString().padStart(2, '0')}`, cells })
  }
  return { cols, rows }
}
