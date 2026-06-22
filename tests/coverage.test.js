// PRD COVERAGE GATE
// Encodes — word-for-word — every metric named in monitoring_prd_en.md and asserts
// each is represented in the dictionary. If a metric is dropped from the dictionary
// this test fails, guaranteeing "nothing left out".
import { describe, it, expect } from 'vitest'
import { METRIC_BY_ID } from '../src/data/metrics.js'

// PRD metric → dictionary metric_id   (label kept verbatim from the document)
const PRD = {
  // §7.2 L0 homepage core metrics (12)
  'L0: Total cards': 'fleet.cards.total',
  'L0: Available cards / availability rate': 'fleet.cards.available',
  'L0: Allocated cards / allocation rate': 'fleet.cards.allocated',
  'L0: Active training cards': 'fleet.cards.active',
  'L0: Average compute utilization': 'fleet.util.compute.avg',
  'L0: Average memory utilization': 'fleet.util.memory.avg',
  'L0: P0 alerts': 'alerts.p0.count',
  'L0: Hardware error events': 'hw.error.events',
  'L0: Thermal/power-limited cards': 'fleet.cards.thermal_power_limited',
  'L0: Training throughput': 'training.throughput.tokens',
  'L0: Low-utilization TopN': 'topn.low_utilization',
  'L0: Idle card-hour cost': 'cost.idle_card_hours',

  // §7.3.1 hardware & system
  'Compute utilization': 'accelerator.utilization.compute.pct',
  'Tensor/matrix unit utilization': 'accelerator.utilization.tensor.pct',
  'Memory utilization': 'accelerator.memory.used.pct',
  'Memory bandwidth': 'accelerator.memory.bandwidth.pct',
  'Temperature': 'accelerator.temperature.celsius',
  'Power': 'accelerator.power.watt',
  'Power-limit hit': 'accelerator.power.limit_hit.pct',
  'Thermal throttle': 'accelerator.thermal.throttle.events',
  'Fan/liquid-cooling state': 'accelerator.cooling.state',
  'Xid': 'accelerator.errors.xid.count',
  'ECC': 'accelerator.errors.ecc.count',
  'Offline card': 'accelerator.offline.events',
  'NVLink/PCIe errors': 'accelerator.link.nvlink_pcie.errors',
  'PPU-native error code': 'accelerator.errors.ppu_native.code',
  'CPU utilization': 'system.cpu.utilization.pct',
  'IOWait': 'system.cpu.iowait.pct',
  'System memory': 'system.memory.used.pct',
  'NUMA imbalance': 'system.numa.imbalance',
  'OOM Kill': 'system.oom.kill.events',
  'Pending time': 'k8s.pod.pending.seconds',
  'Scheduling failures': 'k8s.schedule.failures',
  'Restarts': 'k8s.pod.restarts',
  'Exit Code': 'k8s.pod.exit_code',
  'Resource requests/limits': 'k8s.resource.request_limit',

  // §7.3.2 network & storage
  'NVLink/NVSwitch/PCIe bandwidth': 'network.nvlink.bandwidth',
  'Intra-node link status / errors': 'network.intra.link_status',
  'RoCE/IB bandwidth': 'network.fabric.bandwidth',
  'PFC/ECN': 'network.fabric.pfc_ecn',
  'Port down': 'network.port.down.events',
  'Bit errors': 'network.bit.errors',
  'P99 latency': 'network.latency.p99.us',
  'AllReduce/AllGather/ReduceScatter latency': 'comm.allreduce.duration.ms',
  'Communication bandwidth efficiency': 'comm.bandwidth.efficiency.pct',
  'Communication wait ratio': 'training.wait.communication.pct',
  'DataLoader iteration time': 'dataloader.iteration.ms',
  'Prefetch queue': 'dataloader.prefetch.queue',
  'CPU→GPU/PPU copy': 'dataloader.copy.h2d',
  'IO wait / data wait': 'training.wait.data.pct',
  'Checkpoint save/restore time': 'checkpoint.save.seconds',
  'Checkpoint file size': 'checkpoint.file.size_gb',
  'Checkpoint write bandwidth': 'checkpoint.write.bandwidth',
  'Checkpoint async queue depth': 'checkpoint.async.queue_depth',
  'Checkpoint failures': 'checkpoint.failures',

  // §7.3.3 training efficiency & business ops
  'Step time': 'training.step.time.ms',
  'Step breakdown': 'training.step.breakdown',
  'Tokens/s': 'training.throughput.tokens',
  'Samples/s': 'training.throughput.samples',
  'Per-card throughput': 'training.throughput.per_card',
  'Cluster total throughput': 'training.throughput.cluster',
  'MFU': 'training.mfu.pct',
  'Achieved TFLOPS': 'training.achieved.tflops',
  'Matrix multiplication efficiency': 'accelerator.utilization.tensor.pct',
  'GPU/PPU idle': 'accelerator.idle.pct',
  'Data wait': 'training.wait.data.pct',
  'Synchronization barrier wait': 'training.wait.barrier.pct',
  'Loss spike': 'training.loss.spike',
  'NaN/Inf': 'training.nan_inf.events',
  'Gradient explosion/vanishing': 'training.gradient.anomaly',
  'LR anomaly': 'training.lr.anomaly',
  'Card-hours': 'cost.card_hours',
  'Idle card-hours': 'cost.idle_card_hours',
  'Cost per million tokens': 'cost.per_million_tokens',
  'Goodput': 'cost.goodput.pct',
  'Budget burn': 'cost.budget.burn',
  'Queue depth': 'sched.queue.depth',
  'Queue time': 'sched.queue.time',
  'Resource fragmentation': 'sched.fragmentation.pct',
  'Preemption': 'sched.preemption.events',
  'Quota utilization': 'sched.quota.utilization',

  // §7.4 L2 expert diagnostic
  'SM Occupancy / Warp Occupancy': 'expert.sm.occupancy.pct',
  'L1/L2/L3 Cache / TLB Miss / IPC': 'expert.cache.miss',
  'Operator latency Top20 / memory Top20': 'expert.operator.latency_top',
  'NCCL Debug / algorithm / channels': 'expert.nccl.debug',
  'eBPF syscall / TCP retrans / block IO latency': 'expert.ebpf.syscall',
  'Memory fragmentation / allocator details': 'expert.memory.fragmentation'
}

// §8.1 — metrics that MUST ship a built-in confused-with comparison.
const MUST_HAVE_CONFUSED = [
  'accelerator.utilization.compute.pct',
  'training.mfu.pct',
  'accelerator.memory.used.pct',
  'accelerator.memory.bandwidth.pct',
  'accelerator.idle.pct',
  'training.wait.communication.pct',
  'dataloader.iteration.ms',
  'accelerator.thermal.throttle.events',
  'cost.card_hours',
  'sched.fragmentation.pct'
]

describe('PRD metric coverage (nothing left out)', () => {
  for (const [prdName, id] of Object.entries(PRD)) {
    it(`covers "${prdName}"`, () => {
      expect(METRIC_BY_ID[id], `missing dictionary entry: ${id}`).toBeTruthy()
    })
  }

  it('every L0 homepage metric is marked level L0', () => {
    const l0 = Object.entries(PRD).filter(([k]) => k.startsWith('L0:'))
    for (const [, id] of l0) expect(METRIC_BY_ID[id].level, id).toBe('L0')
  })
})

describe('§8.1 confused-metrics requirement', () => {
  for (const id of MUST_HAVE_CONFUSED) {
    it(`${id} documents easily-confused metrics`, () => {
      expect(METRIC_BY_ID[id]?.confused.length, id).toBeGreaterThan(0)
    })
  }
})
