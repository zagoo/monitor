// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE METRIC DICTIONARY
// Word-for-word coverage of every metric named in monitoring_prd_en.md:
//   · L0 homepage core metrics            (§7.2, 12 metrics)
//   · L1 standard analysis metrics        (§7.3.1 hardware/system, §7.3.2 network/storage,
//                                           §7.3.3 training efficiency & business ops)
//   · L2 expert diagnostic metrics        (§7.4)
//   · §8.1 core metrics w/ built-in tooltips (definition + confused-with)
//
// Each record carries the full tooltip payload requested:
//   def       – definition
//   calc      – calculation logic / formula
//   sig       – significance (why it matters)
//   related   – related metric ids
//   confused  – easily-confused metrics [{ name, diff }]
//   notes     – important caveats
//
// level: L0 | L1 | L2     priority: P0 | P1 | P2 | P3
// layer: hardware | system | k8s | network | storage | comm | training | cost | scheduling | expert
// ─────────────────────────────────────────────────────────────────────────────

const ALL = ['nvidia', 'aliyun_ppu', 'generic']
const NV_PPU = ['nvidia', 'aliyun_ppu']

export const METRIC_DICTIONARY = [
  // ── L0 · Homepage core metrics (§7.2) ───────────────────────────────────────
  {
    metric_id: 'fleet.cards.total', display_name: 'Total Cards', unit: 'cards',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['inventory', 'kubernetes'],
    def: 'Number of managed accelerator cards in scope.',
    calc: 'count(distinct accelerator_id) over the current filter set.',
    sig: 'Capacity baseline that every utilization, allocation and waste ratio is measured against.',
    related: ['fleet.cards.available', 'fleet.cards.allocated'],
    confused: [{ name: 'Allocated cards', diff: 'Total counts all managed cards; allocated counts only those bound to a Job/Pod.' }],
    notes: 'Includes offline/maintenance cards; filter by health to exclude them.'
  },
  {
    metric_id: 'fleet.cards.available', display_name: 'Available Cards / Availability Rate', unit: 'cards / %',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'count+ratio', vendors: ALL,
    default_aggregation: 'count / ratio', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'kubernetes'],
    def: 'Number and ratio of cards whose health_status = healthy.',
    calc: 'healthy_cards / total_cards × 100.',
    sig: 'Primary hardware-health signal for on-call; a falling rate signals failures or maintenance.',
    related: ['fleet.cards.total', 'accelerator.offline.events', 'alerts.p0.count'],
    confused: [{ name: 'Allocation rate', diff: 'Availability is about hardware health; allocation is about scheduling occupancy.' }],
    notes: 'Cards in maintenance windows are reported separately, not as unhealthy.'
  },
  {
    metric_id: 'fleet.cards.allocated', display_name: 'Allocated Cards / Allocation Rate', unit: 'cards / %',
    level: 'L0', priority: 'P0', layer: 'scheduling', type: 'count+ratio', vendors: ALL,
    default_aggregation: 'count / ratio', sources: ['kubernetes', 'scheduler'],
    def: 'Number and ratio of cards bound to a Job or Pod.',
    calc: 'allocated_cards / total_cards × 100.',
    sig: 'Scheduling watermark — how much of the fleet is claimed by workloads.',
    related: ['fleet.cards.active', 'sched.fragmentation.pct', 'cost.card_hours'],
    confused: [{ name: 'Active training cards', diff: 'Allocated means claimed; active means actually computing above the utilization threshold.' }],
    notes: 'A high allocation rate with low active rate is the classic "occupied but unused" waste pattern.'
  },
  {
    metric_id: 'fleet.cards.active', display_name: 'Active Training Cards', unit: 'cards',
    level: 'L0', priority: 'P0', layer: 'training', type: 'count', vendors: NV_PPU,
    default_aggregation: 'count', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'training_hook'],
    def: 'Cards carrying a training workload with compute utilization above the active threshold.',
    calc: 'count(allocated = true AND compute_util_pct > active_threshold).',
    sig: 'Distinguishes genuinely working cards from idle-but-allocated ones.',
    related: ['fleet.cards.allocated', 'accelerator.utilization.compute.pct'],
    confused: [{ name: 'Allocated cards', diff: 'Active is a subset of allocated that is actually computing.' }],
    notes: 'Default active threshold is 25% compute utilization; configurable per profile.'
  },
  {
    metric_id: 'accelerator.utilization.compute.pct', display_name: 'Compute Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'time_weighted_avg', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    scope: ['accelerator', 'pod', 'job', 'region'],
    def: 'Proportion of the sampling window during which accelerator compute units are busy.',
    calc: 'busy_sample_time / total_sample_time × 100, normalized per vendor adapter.',
    sig: 'Tells you whether a card is being used by a workload at all.',
    related: ['training.mfu.pct', 'expert.sm.occupancy.pct', 'accelerator.utilization.tensor.pct'],
    confused: [
      { name: 'MFU', diff: 'MFU measures actual model FLOPs / theoretical peak; high utilization ≠ efficient model compute.' },
      { name: 'SM Occupancy', diff: 'Occupancy is a kernel-level scheduler metric, not a busy/idle measure.' }
    ],
    notes: 'Vendors define "busy" differently — prefer normalized metrics and same-model grouping for cross-model comparison.'
  },
  {
    metric_id: 'accelerator.memory.used.pct', display_name: 'Memory Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    scope: ['accelerator', 'pod', 'job', 'region'],
    def: 'Used device memory / total device memory.',
    calc: 'sum(memory_used_bytes) / sum(memory_total_bytes) × 100; rolled up weighted by card memory capacity.',
    sig: 'Memory-pressure signal; near-full memory risks OOM and limits batch size.',
    related: ['accelerator.memory.bandwidth.pct', 'expert.memory.fragmentation', 'system.oom.kill.events'],
    confused: [
      { name: 'Memory bandwidth utilization', diff: 'Capacity (how full) vs throughput pressure (how fast read/write).' },
      { name: 'Memory fragmentation', diff: 'Full memory is not necessarily slow; high fragmentation can cause OOM even below 100%.' }
    ],
    notes: 'Roll up weighted by memory capacity, not a simple average across heterogeneous models.'
  },
  {
    metric_id: 'accelerator.memory.bandwidth.pct', display_name: 'Memory Bandwidth Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Actual memory read/write bandwidth / theoretical bandwidth.',
    calc: 'measured_bw_bytes_per_s / model_peak_bw_bytes_per_s × 100.',
    sig: 'Detects memory-access bottlenecks even when capacity utilization looks fine.',
    related: ['accelerator.memory.used.pct', 'accelerator.utilization.compute.pct'],
    confused: [{ name: 'Memory utilization', diff: 'Memory utilization is capacity; bandwidth utilization is throughput pressure.' }],
    notes: 'Peak bandwidth metadata is model-specific (H200 4.8 TB/s, RTX PRO 5000 1344 GB/s).'
  },
  {
    metric_id: 'accelerator.utilization.tensor.pct', display_name: 'Tensor / Matrix Unit Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'time_weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Proportion of time the tensor/matrix-multiply units are active.',
    calc: 'tensor_active_cycles / total_cycles × 100.',
    sig: 'A closer proxy for useful matmul work than overall compute utilization.',
    related: ['accelerator.utilization.compute.pct', 'training.mfu.pct'],
    confused: [{ name: 'Compute utilization', diff: 'Compute utilization counts any busy unit; tensor utilization isolates matmul engines.' }],
    notes: 'Availability depends on the adapter; PPU exposes a normalized equivalent.'
  },
  {
    metric_id: 'fleet.util.compute.avg', display_name: 'Average Compute Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'training', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Sample-weighted average compute utilization across cards in scope.',
    calc: 'sum(region_util_avg × region_active_sample_count) / sum(region_active_sample_count).',
    sig: 'Headline resource-usage figure for managers and FinOps.',
    related: ['accelerator.utilization.compute.pct', 'fleet.util.memory.avg'],
    confused: [{ name: 'Per-card compute utilization', diff: 'The fleet figure is a weighted rollup; never a simple mean across heterogeneous models.' }],
    notes: 'Multi-region rollups weight by sample/card count to avoid skew (§6.2).'
  },
  {
    metric_id: 'fleet.util.memory.avg', display_name: 'Average Memory Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Memory-capacity-weighted average memory utilization across cards.',
    calc: 'sum(memory_used_bytes) / sum(memory_total_bytes) × 100.',
    sig: 'Fleet-wide memory pressure indicator.',
    related: ['accelerator.memory.used.pct'],
    confused: [{ name: 'Average compute utilization', diff: 'Memory is capacity pressure; compute is busy time.' }],
    notes: 'Weight by memory capacity since models range 48 GB → 144 GB.'
  },
  {
    metric_id: 'alerts.p0.count', display_name: 'P0 Alerts', unit: 'alerts',
    level: 'L0', priority: 'P0', layer: 'system', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['alert_manager'],
    def: 'Current unrecovered P0 (critical) alerts.',
    calc: 'count(alerts where severity = P0 AND status = firing).',
    sig: 'The on-call entry point — anything here needs immediate action.',
    related: ['accelerator.errors.xid.count', 'accelerator.errors.ecc.count', 'accelerator.offline.events'],
    confused: [{ name: 'Hardware error events', diff: 'Alerts are deduplicated/inhibited incidents; hardware events are raw counter increases.' }],
    notes: 'Inhibition suppresses derived alerts when a card is offline to reduce noise (§15.2).'
  },
  {
    metric_id: 'hw.error.events', display_name: 'Hardware Error Events', unit: 'events',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'node_exporter'],
    def: 'Xid / ECC / offline / PPU-native hardware error events in the window.',
    calc: 'increase(xid + ecc_uncorrectable + offline + ppu_native_error counters) over the time range.',
    sig: 'Failure-localization signal; the first thing to check during incidents.',
    related: ['accelerator.errors.xid.count', 'accelerator.errors.ecc.count', 'accelerator.offline.events', 'accelerator.errors.ppu_native.code'],
    confused: [{ name: 'P0 alerts', diff: 'Raw event increases vs deduplicated firing alerts.' }],
    notes: 'PPU-native error codes are mapped to generic categories by the adapter; Xid/NVLink are not forced onto PPU.'
  },
  {
    metric_id: 'fleet.cards.thermal_power_limited', display_name: 'Thermal / Power-Limited Cards', unit: 'cards',
    level: 'L0', priority: 'P1', layer: 'hardware', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Cards hitting a temperature limit, power limit, or thermal throttle.',
    calc: 'count(thermal_throttle_events > 0 OR power_limit_hit_pct > threshold).',
    sig: 'Performance-degradation signal — throttled cards silently slow training.',
    related: ['accelerator.temperature.celsius', 'accelerator.power.limit_hit.pct', 'accelerator.thermal.throttle.events'],
    confused: [{ name: 'Temperature', diff: 'Temperature is a state; this counts cards whose performance is actually being capped.' }],
    notes: 'Per-model limits differ (H200 700 W, RTX PRO 5000 300 W).'
  },
  {
    metric_id: 'training.throughput.tokens', display_name: 'Training Throughput (Tokens/s)', unit: 'tok/s',
    level: 'L0', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    scope: ['job', 'accelerator', 'cluster'],
    def: 'Aggregated training output measured in tokens per second.',
    calc: 'sum(tokens processed) / elapsed_seconds across selected jobs.',
    sig: 'The business output of the cluster — what training is actually producing.',
    related: ['training.throughput.samples', 'training.throughput.per_card', 'training.mfu.pct'],
    confused: [{ name: 'MFU', diff: 'Tokens/s is raw throughput affected by batch/seq length; MFU normalizes against hardware peak.' }],
    notes: 'Compare per-card throughput only within the same model + parallel strategy.'
  },
  {
    metric_id: 'topn.low_utilization', display_name: 'Low-Utilization TopN', unit: 'ranking',
    level: 'L0', priority: 'P1', layer: 'cost', type: 'topn', vendors: ALL,
    default_aggregation: 'topn', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'scheduler'],
    def: 'Ranking of allocated cards/jobs with the lowest compute utilization.',
    calc: 'rank_bottom_n(compute_util_pct) where allocated = true, sustained for the window.',
    sig: 'Pinpoints where compute is being wasted so it can be reclaimed.',
    related: ['fleet.cards.allocated', 'cost.idle_card_hours', 'accelerator.utilization.compute.pct'],
    confused: [{ name: 'Idle card-hours', diff: 'TopN names the worst offenders; idle card-hours quantifies the total waste.' }],
    notes: 'Preset "allocated AND compute < 20% FOR 15m" drives this list.'
  },
  {
    metric_id: 'cost.idle_card_hours', display_name: 'Idle Card-Hour Cost', unit: 'card-h / $',
    level: 'L0', priority: 'P1', layer: 'cost', type: 'sum', vendors: ALL,
    default_aggregation: 'sum', sources: ['scheduler', 'billing'],
    def: 'Estimated card-hours for unallocated or low-utilization cards, and their cost.',
    calc: 'sum(idle_or_low_util_card_count_per_interval × interval_seconds) / 3600 × card_hour_price.',
    sig: 'Cost-governance signal — turns idle silicon into a dollar figure.',
    related: ['cost.card_hours', 'topn.low_utilization', 'cost.goodput.pct'],
    confused: [{ name: 'Card-hours', diff: 'Card-hours is total consumption; idle card-hours is the wasted portion.' }],
    notes: 'Price model is configurable; SREs may see a normalized cost index instead of dollars (§13.2).'
  },

  // ── L1 · Hardware & system (§7.3.1) ─────────────────────────────────────────
  {
    metric_id: 'accelerator.temperature.celsius', display_name: 'Temperature', unit: '°C',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Accelerator die / hotspot temperature.',
    calc: 'max(sensor_temperature) over the sampling window.',
    sig: 'Leading indicator of thermal throttling and cooling problems.',
    related: ['accelerator.thermal.throttle.events', 'accelerator.power.watt', 'accelerator.cooling.state'],
    confused: [{ name: 'Thermal throttle event', diff: 'Temperature is a continuous state; throttle is the discrete performance-impacting event.' }],
    notes: 'Compare against per-model thermal limits, not one global threshold.'
  },
  {
    metric_id: 'accelerator.power.watt', display_name: 'Power Draw', unit: 'W',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Instantaneous board power draw.',
    calc: 'avg(power_watts) over the window.',
    sig: 'Energy/cost driver and an input to power-limit and cooling analysis.',
    related: ['accelerator.power.limit_hit.pct', 'accelerator.temperature.celsius'],
    confused: [{ name: 'Power-limit hit %', diff: 'Raw watts vs proportion of time the card runs capped at its power limit.' }],
    notes: 'Per-model power limits differ; always interpret relative to the model limit.'
  },
  {
    metric_id: 'accelerator.power.limit_hit.pct', display_name: 'Power-Limit Hit', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Proportion of time the card is clamped at its power limit.',
    calc: 'time_at_power_cap / total_time × 100.',
    sig: 'Indicates performance is being capped by power, not workload.',
    related: ['accelerator.power.watt', 'accelerator.thermal.throttle.events'],
    confused: [{ name: 'Power draw', diff: 'Hit % measures capping; watts measures the level.' }],
    notes: 'Sustained high hit % warrants power/cooling review.'
  },
  {
    metric_id: 'accelerator.thermal.throttle.events', display_name: 'Thermal Throttle Event', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Frequency/event that a device is downclocked or power-limited due to thermal policy.',
    calc: 'increase(throttle_event_counter) over the window.',
    sig: 'Direct cause of silent training slowdowns.',
    related: ['accelerator.temperature.celsius', 'accelerator.power.limit_hit.pct'],
    confused: [{ name: 'Temperature', diff: 'High temperature is a state; thermal throttle is the performance-impacting event.' }],
    notes: 'Alert template fires on throttle_events > 0 FOR 5m (P1).'
  },
  {
    metric_id: 'accelerator.cooling.state', display_name: 'Fan / Liquid-Cooling State', unit: 'state',
    level: 'L1', priority: 'P2', layer: 'hardware', type: 'state', vendors: ALL,
    default_aggregation: 'last', sources: ['node_exporter', 'bmc'],
    def: 'Operational state of fans or the liquid-cooling loop.',
    calc: 'Discrete state read from BMC / node exporter (ok | degraded | fault).',
    sig: 'Root-cause context when temperatures rise across a node or rack.',
    related: ['accelerator.temperature.celsius'],
    confused: [],
    notes: 'Rack/node-level; correlate with co-located cards when diagnosing.'
  },
  {
    metric_id: 'accelerator.errors.xid.count', display_name: 'Xid Errors', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ['nvidia'],
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml'],
    def: 'NVIDIA Xid hardware/driver error events on a card.',
    calc: 'increase(xid_error_counter) over the window.',
    sig: 'Strong fault signal; many Xid codes mean the card should be drained.',
    related: ['accelerator.errors.ecc.count', 'accelerator.offline.events', 'hw.error.events'],
    confused: [{ name: 'ECC errors', diff: 'Xid spans driver/hardware faults broadly; ECC is specifically memory bit errors.' }],
    notes: 'NVIDIA-only; PPU faults are reported via ppu_native error codes instead.'
  },
  {
    metric_id: 'accelerator.errors.ecc.count', display_name: 'ECC Errors', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    def: 'Correctable and uncorrectable memory ECC error counts.',
    calc: 'increase(ecc_correctable) and increase(ecc_uncorrectable) over the window.',
    sig: 'Uncorrectable ECC means data corruption risk — retire the card.',
    related: ['accelerator.errors.xid.count', 'accelerator.memory.used.pct'],
    confused: [{ name: 'Xid errors', diff: 'ECC is memory-specific; Xid is a broader fault category.' }],
    notes: 'Uncorrectable ECC increase > 0 is a P0 alert.'
  },
  {
    metric_id: 'accelerator.offline.events', display_name: 'Offline Card Events', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'kubernetes'],
    def: 'Events where a device drops off the bus / stops reporting.',
    calc: 'increase(device_offline_counter) over the window.',
    sig: 'Hard-failure signal; offline cards block any job scheduled to them.',
    related: ['fleet.cards.available', 'accelerator.errors.xid.count'],
    confused: [{ name: 'Collection stale', diff: 'Offline is a hardware drop; stale is an exporter/data-freshness problem.' }],
    notes: 'Offline-card alerts inhibit derived low-util/temperature alerts for the same card.'
  },
  {
    metric_id: 'accelerator.link.nvlink_pcie.errors', display_name: 'NVLink / PCIe Errors', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ['nvidia'],
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml'],
    def: 'Replay/CRC/link errors on NVLink, NVSwitch or PCIe links.',
    calc: 'increase(link_error_counters) over the window.',
    sig: 'Intra-node interconnect faults degrade collective-communication performance.',
    related: ['network.nvlink.bandwidth', 'comm.allreduce.duration.ms'],
    confused: [{ name: 'Inter-node bit errors', diff: 'These are on-host links; bit errors are on the RoCE/IB fabric.' }],
    notes: 'PPU exposes inter-chip link errors via its own adapter fields.'
  },
  {
    metric_id: 'accelerator.errors.ppu_native.code', display_name: 'PPU-Native Error Code', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'increase', vendors: ['aliyun_ppu'],
    default_aggregation: 'increase', sources: ['ppu_sdk_exporter'],
    def: 'Vendor-native error codes reported by the Zhenwu PPU SDK.',
    calc: 'increase(ppu_native_error_counter) grouped by code.',
    sig: 'PPU equivalent of Xid/ECC for fault localization on Alibaba accelerators.',
    related: ['hw.error.events', 'accelerator.errors.ecc.count'],
    confused: [{ name: 'Xid errors', diff: 'PPU codes are stored in adapter_specific and mapped to generic categories; NVIDIA Xid is not forced onto PPU.' }],
    notes: 'Raw codes kept in adapter_specific; normalized into generic hardware-error categories.'
  },
  {
    metric_id: 'system.cpu.utilization.pct', display_name: 'CPU Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter', 'kubelet'],
    def: 'Host CPU utilization for the node/pod.',
    calc: 'busy_cpu_time / total_cpu_time × 100.',
    sig: 'High CPU can starve the input pipeline and host-side collectives.',
    related: ['system.cpu.iowait.pct', 'training.wait.data.pct'],
    confused: [{ name: 'Compute utilization', diff: 'This is host CPU; compute utilization is the accelerator.' }],
    notes: 'Correlate with DataLoader time when diagnosing input bottlenecks.'
  },
  {
    metric_id: 'system.cpu.iowait.pct', display_name: 'IOWait', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter'],
    def: 'Proportion of CPU time spent waiting on I/O.',
    calc: 'iowait_cpu_time / total_cpu_time × 100.',
    sig: 'System-level view of storage/IO pressure feeding training.',
    related: ['training.wait.data.pct', 'dataloader.iteration.ms'],
    confused: [{ name: 'DataLoader time', diff: 'IOWait is a system perspective; DataLoader time is the training-loop perspective.' }],
    notes: 'High IOWait with high DataLoader time confirms an input-pipeline bottleneck.'
  },
  {
    metric_id: 'system.memory.used.pct', display_name: 'System Memory', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter', 'kubelet'],
    def: 'Host RAM utilization.',
    calc: 'used_bytes / total_bytes × 100.',
    sig: 'Host memory pressure precedes OOM kills of training pods.',
    related: ['system.oom.kill.events', 'system.numa.imbalance'],
    confused: [{ name: 'Device memory utilization', diff: 'This is host RAM, not accelerator HBM.' }],
    notes: 'Pin to NUMA-aware limits for large data pipelines.'
  },
  {
    metric_id: 'system.numa.imbalance', display_name: 'NUMA Imbalance', unit: 'ratio',
    level: 'L1', priority: 'P2', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['node_exporter'],
    def: 'Imbalance of memory/CPU usage across NUMA nodes.',
    calc: 'max(node_usage) / mean(node_usage) across NUMA domains.',
    sig: 'NUMA imbalance hurts host-to-device copy and DataLoader throughput.',
    related: ['system.memory.used.pct', 'dataloader.copy.h2d'],
    confused: [],
    notes: 'Address with NUMA-pinned workers and memory affinity.'
  },
  {
    metric_id: 'system.oom.kill.events', display_name: 'OOM Kill', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'system', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kubelet', 'node_exporter'],
    def: 'Out-of-memory kill events for containers/processes.',
    calc: 'increase(oom_kill_counter) over the window.',
    sig: 'Abruptly terminates training; a top cause of unexplained restarts.',
    related: ['system.memory.used.pct', 'k8s.pod.restarts', 'expert.memory.fragmentation'],
    confused: [{ name: 'Device OOM', diff: 'Host OOM kills the process; device OOM is HBM allocation failure inside the framework.' }],
    notes: 'Pair with allocator details (expert) to find leaks vs. genuine over-allocation.'
  },
  {
    metric_id: 'k8s.pod.pending.seconds', display_name: 'Pod Pending Time', unit: 's',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['kube_state_metrics'],
    def: 'Time a pod spends in Pending before being scheduled.',
    calc: 'scheduled_time − created_time, summarized as P50/P95.',
    sig: 'Long pending times point to capacity or fragmentation problems.',
    related: ['sched.queue.time', 'sched.fragmentation.pct', 'k8s.schedule.failures'],
    confused: [{ name: 'Queue time', diff: 'Pending is the K8s-level wait; queue time is the scheduler/quota-level wait.' }],
    notes: 'P95 > SLO FOR 15m raises a queue-backlog alert.'
  },
  {
    metric_id: 'k8s.schedule.failures', display_name: 'Scheduling Failures', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kube_state_metrics', 'scheduler'],
    def: 'Failed scheduling attempts (unschedulable events).',
    calc: 'increase(scheduling_failure_counter) over the window.',
    sig: 'Surfaces topology/quota/affinity constraints blocking placement.',
    related: ['sched.fragmentation.pct', 'k8s.pod.pending.seconds'],
    confused: [{ name: 'Resource fragmentation', diff: 'Failures are the symptom; fragmentation is a common cause.' }],
    notes: 'Group failure reasons to distinguish quota vs. topology vs. affinity.'
  },
  {
    metric_id: 'k8s.pod.restarts', display_name: 'Pod Restarts', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kube_state_metrics'],
    def: 'Container restart count for training pods.',
    calc: 'increase(container_restart_count) over the window.',
    sig: 'Frequent restarts indicate crashes, OOM, or hardware flapping.',
    related: ['k8s.pod.exit_code', 'system.oom.kill.events'],
    confused: [],
    notes: 'Join with exit code to classify the failure mode.'
  },
  {
    metric_id: 'k8s.pod.exit_code', display_name: 'Exit Code', unit: 'code',
    level: 'L1', priority: 'P2', layer: 'k8s', type: 'state', vendors: ALL,
    default_aggregation: 'last', sources: ['kube_state_metrics'],
    def: 'Last container termination exit code.',
    calc: 'Reported by kubelet on container exit.',
    sig: 'Classifies why a pod stopped (OOM 137, error 1, etc.).',
    related: ['k8s.pod.restarts', 'system.oom.kill.events'],
    confused: [],
    notes: '137 typically means OOM-kill; 0 is clean shutdown.'
  },
  {
    metric_id: 'k8s.resource.request_limit', display_name: 'Resource Requests / Limits', unit: 'ratio',
    level: 'L1', priority: 'P2', layer: 'k8s', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['kube_state_metrics'],
    def: 'Configured CPU/memory/accelerator requests and limits vs actual use.',
    calc: 'actual_usage / requested (and / limit) per resource.',
    sig: 'Over-requested pods cause fragmentation; under-requested pods get throttled/OOM.',
    related: ['sched.fragmentation.pct', 'system.memory.used.pct'],
    confused: [],
    notes: 'A key FinOps right-sizing input.'
  },

  // ── L1 · Network & storage (§7.3.2) ─────────────────────────────────────────
  {
    metric_id: 'network.nvlink.bandwidth', display_name: 'NVLink / NVSwitch / PCIe Bandwidth', unit: 'GB/s',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Intra-node interconnect bandwidth on NVLink/NVSwitch/PCIe (or PPU inter-chip links).',
    calc: 'measured_bytes_per_s on each link, summed/averaged per node.',
    sig: 'Caps how fast gradients move between cards inside a node.',
    related: ['accelerator.link.nvlink_pcie.errors', 'comm.bandwidth.efficiency.pct'],
    confused: [{ name: 'Inter-node fabric bandwidth', diff: 'This is on-host links; fabric bandwidth is across the RoCE/IB network.' }],
    notes: 'PPU inter-chip interconnect (700/800 GB/s) reported through the PPU adapter.'
  },
  {
    metric_id: 'network.intra.link_status', display_name: 'Intra-Node Link Status / Errors', unit: 'state',
    level: 'L1', priority: 'P1', layer: 'network', type: 'state', vendors: NV_PPU,
    default_aggregation: 'last', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Up/down/degraded status and error counts of intra-node links.',
    calc: 'Discrete link state plus increase(link_error_counter).',
    sig: 'A degraded link silently halves effective interconnect bandwidth.',
    related: ['network.nvlink.bandwidth', 'accelerator.link.nvlink_pcie.errors'],
    confused: [],
    notes: 'Correlate with collective-communication latency spikes.'
  },
  {
    metric_id: 'network.fabric.bandwidth', display_name: 'RoCE / IB Bandwidth', unit: 'Gb/s',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['network_exporter'],
    def: 'Inter-node fabric bandwidth over RoCE or InfiniBand.',
    calc: 'measured tx/rx bytes_per_s per NIC/port.',
    sig: 'Determines multi-node training scalability.',
    related: ['network.fabric.pfc_ecn', 'network.latency.p99.us', 'comm.bandwidth.efficiency.pct'],
    confused: [{ name: 'NVLink bandwidth', diff: 'Fabric is between nodes; NVLink is within a node.' }],
    notes: 'fabric_id/nic_id labels keep cross-fabric results separated.'
  },
  {
    metric_id: 'network.fabric.pfc_ecn', display_name: 'PFC / ECN', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: 'Priority-flow-control pauses and ECN congestion marks.',
    calc: 'increase(pfc_pause_frames) and increase(ecn_marked_packets).',
    sig: 'High PFC/ECN means fabric congestion that stalls collectives.',
    related: ['network.fabric.bandwidth', 'training.wait.communication.pct'],
    confused: [{ name: 'Bit errors', diff: 'PFC/ECN is congestion control; bit errors are physical-layer corruption.' }],
    notes: 'Sustained pauses indicate a need for topology or QoS tuning.'
  },
  {
    metric_id: 'network.port.down.events', display_name: 'Port Down', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: 'NIC/switch port down/flap events.',
    calc: 'increase(port_down_counter) over the window.',
    sig: 'A down port removes a node from collective groups, stalling the job.',
    related: ['network.fabric.bandwidth', 'network.bit.errors'],
    confused: [],
    notes: 'Often the root cause behind a sudden communication-wait spike.'
  },
  {
    metric_id: 'network.bit.errors', display_name: 'Bit Errors', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: 'Physical-layer bit/symbol error counts on fabric links.',
    calc: 'increase(symbol_error_counter) over the window.',
    sig: 'Rising bit errors precede port flaps and retransmission storms.',
    related: ['network.port.down.events', 'expert.ebpf.syscall'],
    confused: [{ name: 'PFC/ECN', diff: 'Bit errors are corruption; PFC/ECN is congestion signaling.' }],
    notes: 'Check cabling/optics on offending ports.'
  },
  {
    metric_id: 'network.latency.p99.us', display_name: 'Network P99 Latency', unit: 'µs',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: ALL,
    default_aggregation: 'p99', sources: ['network_exporter'],
    def: 'Tail (P99) inter-node network latency.',
    calc: 'p99(round_trip_latency) over the window.',
    sig: 'Tail latency dominates synchronous collective performance.',
    related: ['comm.allreduce.duration.ms', 'network.fabric.pfc_ecn'],
    confused: [{ name: 'AllReduce latency', diff: 'Network latency is link-level; AllReduce latency is the collective operation end-to-end.' }],
    notes: 'Use P99 not average — averages hide the stragglers that block sync.'
  },
  {
    metric_id: 'comm.allreduce.duration.ms', display_name: 'Collective Communication Latency', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'comm', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['nccl', 'training_hook'],
    def: 'AllReduce / AllGather / ReduceScatter operation latency.',
    calc: 'p50/p95/p99 of per-collective duration captured by the framework hook / NCCL.',
    sig: 'Core distributed-training cost; slow collectives throttle every step.',
    related: ['comm.bandwidth.efficiency.pct', 'training.wait.communication.pct', 'network.latency.p99.us'],
    confused: [{ name: 'Communication wait ratio', diff: 'A single slow op may not matter; wait ratio shows whether it blocks training.' }],
    notes: 'Enable NCCL debug (expert) only for anomalous jobs to avoid log flooding.'
  },
  {
    metric_id: 'comm.bandwidth.efficiency.pct', display_name: 'Communication Bandwidth Efficiency', unit: '%',
    level: 'L1', priority: 'P1', layer: 'comm', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['nccl', 'training_hook'],
    def: 'Achieved collective bandwidth / theoretical bus bandwidth.',
    calc: 'measured_busbw / peak_busbw × 100.',
    sig: 'Low efficiency signals suboptimal NCCL algorithm/topology or contention.',
    related: ['comm.allreduce.duration.ms', 'network.nvlink.bandwidth'],
    confused: [{ name: 'Fabric bandwidth', diff: 'Efficiency is relative to peak; fabric bandwidth is the absolute rate.' }],
    notes: 'Compare within the same parallel strategy; algorithm selection changes the ceiling.'
  },
  {
    metric_id: 'training.wait.communication.pct', display_name: 'Communication Wait Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'nccl'],
    scope: ['job', 'node'],
    def: 'Proportion of a step spent waiting on collective communication or sync barriers.',
    calc: 'communication_wait_time / step_time × 100.',
    sig: 'Tells you whether communication is on the critical path of the step.',
    related: ['comm.allreduce.duration.ms', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: 'NCCL AllReduce latency', diff: 'A single slow op may not affect total training; high wait ratio means it blocks training.' }],
    notes: '> 30% FOR 10m raises a communication-bottleneck alert.'
  },
  {
    metric_id: 'dataloader.iteration.ms', display_name: 'DataLoader Iteration Time', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['dataloader_hook'],
    def: 'Time per step spent reading, decoding and preprocessing data.',
    calc: 'p50/p95 of per-iteration DataLoader duration.',
    sig: 'The most common silent training bottleneck after communication.',
    related: ['training.wait.data.pct', 'dataloader.prefetch.queue', 'system.cpu.iowait.pct'],
    confused: [
      { name: 'IOWait', diff: 'DataLoader time is a training-loop view; IOWait is the system view.' },
      { name: 'CPU utilization', diff: 'High CPU may cause slow DataLoader, but they measure different things.' }
    ],
    notes: 'p95 > baseline × 1.2 flags a data bottleneck.'
  },
  {
    metric_id: 'dataloader.prefetch.queue', display_name: 'Prefetch Queue Depth', unit: 'items',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['dataloader_hook'],
    def: 'Depth of the input prefetch queue feeding the training loop.',
    calc: 'avg(queued_batches) over the window.',
    sig: 'A chronically empty queue means the loader cannot keep up with the device.',
    related: ['dataloader.iteration.ms', 'training.wait.data.pct'],
    confused: [],
    notes: 'Scale workers or prefetch factor when the queue starves.'
  },
  {
    metric_id: 'dataloader.copy.h2d', display_name: 'CPU→GPU/PPU Copy', unit: 'ms',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['dataloader_hook', 'profiler'],
    def: 'Host-to-device memory copy time per step.',
    calc: 'p95(host_to_device_copy_ms).',
    sig: 'Large copies overlap poorly with compute and inflate step time.',
    related: ['dataloader.iteration.ms', 'system.numa.imbalance'],
    confused: [],
    notes: 'Use pinned memory and NUMA-local staging to reduce.'
  },
  {
    metric_id: 'training.wait.data.pct', display_name: 'Data Wait Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['training_hook', 'dataloader_hook'],
    scope: ['job', 'accelerator'],
    def: 'Proportion of a step spent waiting on data (DataLoader / IO).',
    calc: 'data_wait_time / step_time × 100.',
    sig: 'Quantifies how much the input pipeline is starving the device.',
    related: ['dataloader.iteration.ms', 'system.cpu.iowait.pct', 'training.wait.communication.pct'],
    confused: [{ name: 'IOWait', diff: 'Data wait is the training perspective; IOWait/CPU are system perspectives.' }],
    notes: 'High memory + low compute + high data wait is the classic input-bottleneck signature.'
  },
  {
    metric_id: 'checkpoint.save.seconds', display_name: 'Checkpoint Save / Restore Time', unit: 's',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['checkpoint_hook'],
    def: 'Time to save or restore a checkpoint.',
    calc: 'max(save_duration) and max(restore_duration) per event.',
    sig: 'Long synchronous saves stall every rank; restore time affects recovery RTO.',
    related: ['checkpoint.write.bandwidth', 'checkpoint.file.size_gb', 'checkpoint.async.queue_depth'],
    confused: [],
    notes: 'Prefer async/ sharded checkpointing to hide save latency.'
  },
  {
    metric_id: 'checkpoint.file.size_gb', display_name: 'Checkpoint File Size', unit: 'GB',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'last', sources: ['checkpoint_hook'],
    def: 'Size of the most recent checkpoint.',
    calc: 'sum(shard_bytes) / 1e9.',
    sig: 'Drives save time, storage cost and restore RTO.',
    related: ['checkpoint.save.seconds', 'checkpoint.write.bandwidth'],
    confused: [],
    notes: 'Grows with model + optimizer state; sharding spreads it across ranks.'
  },
  {
    metric_id: 'checkpoint.write.bandwidth', display_name: 'Checkpoint Write Bandwidth', unit: 'GB/s',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['checkpoint_hook', 'storage_exporter'],
    def: 'Throughput achieved while writing a checkpoint.',
    calc: 'checkpoint_bytes / save_seconds.',
    sig: 'Low write bandwidth lengthens stalls and may indicate storage contention.',
    related: ['checkpoint.save.seconds', 'checkpoint.file.size_gb'],
    confused: [],
    notes: 'Compare against the storage backend ceiling and concurrent writers.'
  },
  {
    metric_id: 'checkpoint.async.queue_depth', display_name: 'Checkpoint Async Queue Depth', unit: 'items',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['checkpoint_hook'],
    def: 'Pending writes in the asynchronous checkpoint queue.',
    calc: 'max(async_write_queue_length).',
    sig: 'A growing queue means saves are not keeping up and may block soon.',
    related: ['checkpoint.write.bandwidth', 'checkpoint.failures'],
    confused: [],
    notes: 'Backpressure here eventually turns async saves into blocking ones.'
  },
  {
    metric_id: 'checkpoint.failures', display_name: 'Checkpoint Failures', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['checkpoint_hook'],
    def: 'Failed checkpoint save/restore attempts.',
    calc: 'increase(checkpoint_failure_counter).',
    sig: 'Failed checkpoints risk losing training progress on a crash.',
    related: ['checkpoint.save.seconds', 'k8s.pod.restarts'],
    confused: [],
    notes: 'Correlate with storage errors and pod restarts.'
  },

  // ── L1 · Training efficiency & business ops (§7.3.3) ────────────────────────
  {
    metric_id: 'training.step.time.ms', display_name: 'Step Time', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['training_hook'],
    scope: ['job'],
    def: 'Wall-clock time per training step, summarized P50/P95/P99.',
    calc: 'percentiles of per-step duration from the framework hook.',
    sig: 'The master efficiency metric; everything else explains its breakdown.',
    related: ['training.step.breakdown', 'training.throughput.tokens', 'training.wait.communication.pct'],
    confused: [{ name: 'Throughput', diff: 'Step time is per-iteration latency; throughput folds in batch/seq length.' }],
    notes: 'Baseline-deviation alert: step time > same-job historical P95 × 1.2.'
  },
  {
    metric_id: 'training.step.breakdown', display_name: 'Step-Time Breakdown', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'composite', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    scope: ['job'],
    def: 'Decomposition of a step into forward, backward, optimizer, communication, data loading, checkpoint and idle/barrier.',
    calc: 'each phase_time / step_time × 100 from hook + profiler instrumentation.',
    sig: 'Turns "the job is slow" into "which phase is slow" — the core diagnosis path.',
    related: ['training.step.time.ms', 'training.wait.communication.pct', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: 'Idle/Barrier', diff: 'Idle is the outcome phase; communication/data wait are causal phases inside the step.' }],
    notes: 'Phases: Forward, Backward, Optimizer, Communication, Data Loading, Checkpoint, Idle/Barrier.'
  },
  {
    metric_id: 'training.throughput.samples', display_name: 'Throughput (Samples/s)', unit: 'samples/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    def: 'Samples processed per second.',
    calc: 'sum(samples) / elapsed_seconds.',
    sig: 'Throughput view for non-token workloads (vision, audio, multimodal).',
    related: ['training.throughput.tokens', 'training.throughput.per_card'],
    confused: [{ name: 'Tokens/s', diff: 'Samples/s vs token-level throughput; choose per modality.' }],
    notes: 'Normalize by sequence length when comparing to Tokens/s.'
  },
  {
    metric_id: 'training.throughput.per_card', display_name: 'Per-Card Throughput', unit: 'tok/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook'],
    def: 'Throughput attributed to a single accelerator.',
    calc: 'job_throughput / active_card_count.',
    sig: 'Reveals stragglers and per-card efficiency differences.',
    related: ['training.throughput.tokens', 'training.mfu.pct'],
    confused: [{ name: 'Cluster total throughput', diff: 'Per-card normalizes by card count; cluster total is the aggregate.' }],
    notes: 'Compare only within the same model + parallel strategy.'
  },
  {
    metric_id: 'training.throughput.cluster', display_name: 'Cluster Total Throughput', unit: 'tok/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    def: 'Aggregate throughput across all training jobs in scope.',
    calc: 'sum(job_throughput) across the filter set.',
    sig: 'Top-line cluster output for capacity and trend reporting.',
    related: ['training.throughput.tokens', 'training.throughput.per_card'],
    confused: [],
    notes: 'Roll up by region/model to compare clusters fairly.'
  },
  {
    metric_id: 'training.mfu.pct', display_name: 'MFU (Model FLOPs Utilization)', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'token_weighted', sources: ['training_hook'],
    scope: ['job', 'accelerator'],
    def: 'Actual model FLOPs per second / theoretical peak FLOPs of the accelerator model.',
    calc: 'achieved_model_flops_per_s / accelerator_peak_flops_for_precision × 100.',
    sig: 'The truest measure of training efficiency — how much of the silicon you actually use.',
    related: ['training.achieved.tflops', 'accelerator.utilization.compute.pct', 'training.throughput.tokens'],
    confused: [
      { name: 'GPU utilization', diff: 'GPU utilization reflects busy/idle; MFU reflects effective model compute efficiency.' },
      { name: 'Tokens/s', diff: 'Tokens/s is business throughput affected by batch size, sequence length and parallel strategy.' }
    ],
    notes: 'Needs model FLOPs and precision-aware peak metadata; do not average across models — use token/step weighting. High GPU util + low MFU usually means low kernel efficiency, communication wait, padding waste or a poor parallel strategy.'
  },
  {
    metric_id: 'training.achieved.tflops', display_name: 'Achieved TFLOPS', unit: 'TFLOPS',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    def: 'Measured floating-point throughput delivered to the model.',
    calc: 'model_flops / elapsed_seconds / 1e12.',
    sig: 'Absolute companion to MFU for matmul efficiency analysis.',
    related: ['training.mfu.pct', 'accelerator.utilization.tensor.pct'],
    confused: [{ name: 'MFU', diff: 'TFLOPS is absolute; MFU is the ratio to the hardware peak.' }],
    notes: 'Precision matters — quote alongside FP16/BF16/FP8 peak.'
  },
  {
    metric_id: 'accelerator.idle.pct', display_name: 'GPU/PPU Idle Time', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    def: 'Proportion of a step during which the device has no effective kernel/operator execution.',
    calc: 'idle_time / step_time × 100.',
    sig: 'Quantifies wasted device time; the symptom that wait ratios explain.',
    related: ['training.wait.communication.pct', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: 'Communication / data wait', diff: 'Idle is the outcome; communication and data wait are the causal breakdown.' }],
    notes: 'Decompose idle into its causes before optimizing.'
  },
  {
    metric_id: 'training.wait.barrier.pct', display_name: 'Synchronization Barrier Wait', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook'],
    def: 'Proportion of a step spent waiting at synchronization barriers for the slowest rank.',
    calc: 'barrier_wait_time / step_time × 100.',
    sig: 'Exposes straggler cards/nodes dragging the whole job.',
    related: ['training.wait.communication.pct', 'accelerator.idle.pct'],
    confused: [{ name: 'Communication wait', diff: 'Barrier wait is sync stalls from stragglers; communication wait is collective transfer time.' }],
    notes: 'Cross-reference the accelerator skew matrix to find the straggler.'
  },
  {
    metric_id: 'training.loss.spike', display_name: 'Loss Spike', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: 'Detected sudden increases in training loss.',
    calc: 'loss > rolling_mean + k × rolling_std (spike detector).',
    sig: 'Early warning of divergence, bad data, or LR problems.',
    related: ['training.nan_inf.events', 'training.gradient.anomaly', 'training.lr.anomaly'],
    confused: [],
    notes: 'Overlay on the loss curve and step timeline for context.'
  },
  {
    metric_id: 'training.nan_inf.events', display_name: 'NaN / Inf', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'training', type: 'increase', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: 'Occurrences of NaN or Inf in loss/gradients/activations.',
    calc: 'increase(nan_inf_counter) over the window.',
    sig: 'Corrupts training; usually requires rollback to a checkpoint.',
    related: ['training.loss.spike', 'training.gradient.anomaly'],
    confused: [],
    notes: 'Common with FP16 overflow — consider loss scaling / BF16.'
  },
  {
    metric_id: 'training.gradient.anomaly', display_name: 'Gradient Explosion / Vanishing', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: 'Gradient norm crossing explosion or vanishing thresholds.',
    calc: 'grad_norm > high_threshold OR < low_threshold.',
    sig: 'Indicates instability requiring clipping or LR adjustment.',
    related: ['training.loss.spike', 'training.lr.anomaly', 'training.nan_inf.events'],
    confused: [],
    notes: 'Track grad-norm trend, not just threshold crossings.'
  },
  {
    metric_id: 'training.lr.anomaly', display_name: 'Learning-Rate Anomaly', unit: 'events',
    level: 'L1', priority: 'P2', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: 'Learning-rate values or schedule deviating from the expected curve.',
    calc: 'lr deviates from the configured schedule beyond tolerance.',
    sig: 'A misconfigured schedule silently wrecks convergence.',
    related: ['training.loss.spike', 'training.gradient.anomaly'],
    confused: [],
    notes: 'Overlay the LR schedule with the loss curve to validate.'
  },
  {
    metric_id: 'cost.card_hours', display_name: 'Card-Hours', unit: 'card-h',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'sum', vendors: ALL,
    default_aggregation: 'sum', sources: ['scheduler', 'billing'],
    scope: ['job', 'user', 'tenant'],
    def: 'Number of allocated or used accelerator cards × time.',
    calc: 'sum(allocated_card_count_per_interval × interval_seconds) / 3600.',
    sig: 'The fundamental unit of compute cost and chargeback.',
    related: ['cost.idle_card_hours', 'cost.goodput.pct', 'cost.per_million_tokens'],
    confused: [
      { name: 'Idle card-hours', diff: 'Card-hours is total consumption; idle card-hours is the wasted subset.' },
      { name: 'Goodput', diff: 'Card-hours is a cost metric; Goodput measures the ratio of effective training time.' }
    ],
    notes: 'Track allocated vs active card-hours to expose waste.'
  },
  {
    metric_id: 'cost.per_million_tokens', display_name: 'Cost per Million Tokens', unit: '$/Mtok',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['billing', 'training_hook'],
    def: 'Compute cost to train one million tokens.',
    calc: '(card_hours × card_hour_price) / (tokens_processed / 1e6).',
    sig: 'The unit-economics metric leadership cares about.',
    related: ['cost.card_hours', 'training.throughput.tokens', 'cost.goodput.pct'],
    confused: [{ name: 'Card-hours', diff: 'Cost/Mtok normalizes spend by output; card-hours is raw consumption.' }],
    notes: '> baseline × 1.3 (or Goodput < 70%) flags a cost anomaly.'
  },
  {
    metric_id: 'cost.goodput.pct', display_name: 'Goodput', unit: '%',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'scheduler'],
    def: 'Ratio of effective (useful) training time to wall-clock allocated time.',
    calc: 'useful_training_time_seconds / wall_clock_allocated_seconds × 100.',
    sig: 'Captures real productivity lost to restarts, stalls and waste.',
    related: ['cost.card_hours', 'accelerator.idle.pct', 'cost.per_million_tokens'],
    confused: [{ name: 'Card-hours', diff: 'Goodput is an efficiency ratio; card-hours is absolute consumption.' }],
    notes: 'Target ≥ 80%; lower means a lot of allocated time is not producing training.'
  },
  {
    metric_id: 'cost.budget.burn', display_name: 'Budget Burn', unit: '%',
    level: 'L1', priority: 'P2', layer: 'cost', type: 'gauge', vendors: ALL,
    default_aggregation: 'sum', sources: ['billing'],
    def: 'Share of an allocated budget consumed over a period.',
    calc: 'spend_to_date / budget × 100.',
    sig: 'Keeps tenants/projects inside their financial envelope.',
    related: ['cost.card_hours', 'cost.per_million_tokens'],
    confused: [],
    notes: 'budget_used.pct > threshold raises a cost-over-budget alert (P2).'
  },
  {
    metric_id: 'sched.queue.depth', display_name: 'Queue Depth', unit: 'jobs',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: 'Number of jobs/pods waiting in the scheduling queue.',
    calc: 'count(pending jobs) per queue.',
    sig: 'Backlog indicator for capacity and fairness decisions.',
    related: ['sched.queue.time', 'sched.fragmentation.pct', 'k8s.pod.pending.seconds'],
    confused: [{ name: 'Queue time', diff: 'Depth is how many wait; time is how long they wait.' }],
    notes: 'Persistent depth with idle cards points to fragmentation/quota limits.'
  },
  {
    metric_id: 'sched.queue.time', display_name: 'Queue Time', unit: 'min',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['scheduler'],
    def: 'Time a job waits in queue before starting.',
    calc: 'p50/p95 of (start_time − submit_time).',
    sig: 'Direct measure of platform responsiveness / SLO attainment.',
    related: ['sched.queue.depth', 'k8s.pod.pending.seconds'],
    confused: [{ name: 'Pod pending time', diff: 'Queue time is scheduler/quota-level; pending time is K8s placement-level.' }],
    notes: 'P95 > 30 min breaches the example queue SLO.'
  },
  {
    metric_id: 'sched.fragmentation.pct', display_name: 'Resource Fragmentation Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: 'Ratio of remaining resources that cannot be scheduled due to model/topology/quota constraints.',
    calc: 'unschedulable_free_cards / total_free_cards × 100.',
    sig: 'Explains "cards exist but jobs still queue."',
    related: ['sched.queue.depth', 'k8s.schedule.failures', 'fleet.cards.allocated'],
    confused: [{ name: 'Idle card count', diff: 'Having idle cards does not mean a large job can be scheduled; fragmentation captures unusable capacity.' }],
    notes: 'Break down by region/model/topology to target defragmentation.'
  },
  {
    metric_id: 'sched.preemption.events', display_name: 'Preemption', unit: 'events',
    level: 'L1', priority: 'P2', layer: 'scheduling', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['scheduler'],
    def: 'Jobs/pods preempted to free resources for higher-priority work.',
    calc: 'increase(preemption_counter) over the window.',
    sig: 'High preemption hurts Goodput and fairness.',
    related: ['cost.goodput.pct', 'k8s.pod.restarts'],
    confused: [],
    notes: 'Frequent preemption of the same tenant signals a quota/priority misconfig.'
  },
  {
    metric_id: 'sched.quota.utilization', display_name: 'Quota Utilization', unit: '%',
    level: 'L1', priority: 'P2', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: 'Share of a tenant/queue quota currently in use.',
    calc: 'used_quota / assigned_quota × 100.',
    sig: 'Fairness and capacity-planning input across tenants.',
    related: ['fleet.cards.allocated', 'sched.queue.time'],
    confused: [],
    notes: 'Quota saturation with a deep queue justifies expanding the tenant allocation.'
  },

  // ── L2 · Expert diagnostic metrics (§7.4) ───────────────────────────────────
  {
    metric_id: 'expert.sm.occupancy.pct', display_name: 'SM / Warp Occupancy', unit: '%',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ['nvidia'],
    default_aggregation: 'avg', sources: ['profiler', 'dcgm_exporter'],
    def: 'Active warps per SM relative to the architectural maximum.',
    calc: 'active_warps / max_warps_per_sm × 100.',
    sig: 'Localizes CUDA-kernel inefficiency for performance tuning.',
    related: ['accelerator.utilization.compute.pct', 'training.mfu.pct', 'expert.operator.latency_top'],
    confused: [{ name: 'Compute utilization', diff: 'Occupancy is a kernel-scheduler metric; utilization is coarse busy/idle.' }],
    notes: 'Not collected globally by default — enabled only for selected jobs.'
  },
  {
    metric_id: 'expert.cache.miss', display_name: 'Cache / TLB Miss / IPC', unit: 'ratio',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ['nvidia', 'generic'],
    default_aggregation: 'avg', sources: ['profiler', 'ebpf'],
    def: 'L1/L2/L3 cache miss rates, TLB misses and instructions-per-cycle.',
    calc: 'miss_events / access_events; IPC = instructions / cycles.',
    sig: 'Pinpoints CPU/memory-subsystem bottlenecks.',
    related: ['expert.ebpf.syscall', 'system.cpu.utilization.pct'],
    confused: [],
    notes: 'Sampled within collection windows; not stored in core TSDB.'
  },
  {
    metric_id: 'expert.operator.latency_top', display_name: 'Operator Latency Top20 / Memory Top20', unit: 'ms / MB',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'topn', vendors: NV_PPU,
    default_aggregation: 'topn', sources: ['profiler'],
    def: 'The 20 slowest operators and the 20 largest memory-consuming operators.',
    calc: 'rank_top_n(operator_duration) and rank_top_n(operator_memory) from profiler traces.',
    sig: 'Directs model-level optimization to the operators that actually matter.',
    related: ['expert.sm.occupancy.pct', 'training.step.breakdown'],
    confused: [],
    notes: 'PyTorch Profiler sampled on a schedule; operator names live in the profile store, not core TSDB.'
  },
  {
    metric_id: 'expert.nccl.debug', display_name: 'NCCL Debug / Algorithm / Channels', unit: 'info',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'state', vendors: ['nvidia'],
    default_aggregation: 'last', sources: ['nccl'],
    def: 'NCCL algorithm selection, channel/ring information and debug output.',
    calc: 'Parsed from NCCL debug logs for a given collective.',
    sig: 'Explains why collective bandwidth efficiency is low.',
    related: ['comm.bandwidth.efficiency.pct', 'comm.allreduce.duration.ms'],
    confused: [],
    notes: 'Enabled only for anomalous jobs to avoid log flooding.'
  },
  {
    metric_id: 'expert.ebpf.syscall', display_name: 'eBPF Syscall / TCP Retrans / Block-IO Latency', unit: 'mixed',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['ebpf'],
    def: 'System-level syscall latency, TCP retransmissions and block-IO latency captured via eBPF.',
    calc: 'eBPF probes sampled in short windows; percentiles per probe.',
    sig: 'Locates system-level bottlenecks invisible to higher-level metrics.',
    related: ['expert.cache.miss', 'network.bit.errors', 'system.cpu.iowait.pct'],
    confused: [],
    notes: 'Event-triggered or short-window sampling to bound overhead.'
  },
  {
    metric_id: 'expert.memory.fragmentation', display_name: 'Memory Fragmentation / Allocator Details', unit: '%',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'max', sources: ['framework_hook'],
    def: 'Device-memory fragmentation and allocator pool statistics.',
    calc: 'fragmented_free_bytes / total_free_bytes × 100, plus allocator pool stats.',
    sig: 'Diagnoses OOM and memory leaks even when utilization looks fine.',
    related: ['accelerator.memory.used.pct', 'system.oom.kill.events'],
    confused: [{ name: 'Memory utilization', diff: 'Fragmentation can cause OOM well below 100% capacity.' }],
    notes: 'Requires framework hook support; sampled on demand.'
  }
]

export const METRIC_BY_ID = Object.fromEntries(METRIC_DICTIONARY.map((m) => [m.metric_id, m]))

// Grouping helpers for the Settings dictionary view.
export const LEVELS = ['L0', 'L1', 'L2']
export const LEVEL_META = {
  L0: { label: 'L0 · Homepage Core', desc: 'Fast global judgement (Overview first screen). ≤ 12 metrics.' },
  L1: { label: 'L1 · Standard Analysis', desc: 'Daily troubleshooting & capacity ops (Resources / Jobs / Trends).' },
  L2: { label: 'L2 · Expert Diagnostic', desc: 'Deep performance & chip-adaptation, opened on demand.' }
}
export const LAYER_LABEL = {
  hardware: 'Hardware', system: 'System', k8s: 'Kubernetes', network: 'Network',
  storage: 'Storage', comm: 'Collective Comm', training: 'Training', cost: 'Cost', scheduling: 'Scheduling', expert: 'Expert'
}

export function metricsByLevel(level) {
  return METRIC_DICTIONARY.filter((m) => m.level === level)
}
