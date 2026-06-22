// Static metadata catalog: regions, accelerator types, metric dictionary, tenants.
// Mirrors the unified data model in monitoring_prd_en.md §5.

export const REGIONS = [
  { region_id: 'cn-hangzhou', region_name: 'Hangzhou', cloud_provider: 'Aliyun', timezone: 'Asia/Shanghai', status: 'online' },
  { region_id: 'cn-wulanchabu', region_name: 'Ulanqab', cloud_provider: 'Aliyun', timezone: 'Asia/Shanghai', status: 'online' },
  { region_id: 'cn-shenzhen', region_name: 'Shenzhen', cloud_provider: 'Self-built', timezone: 'Asia/Shanghai', status: 'degraded' },
  { region_id: 'us-west-2', region_name: 'US West', cloud_provider: 'AWS', timezone: 'America/Los_Angeles', status: 'online' }
]

export const ACCELERATOR_TYPES = [
  {
    vendor: 'nvidia', model: 'H200', label: 'NVIDIA H200', architecture: 'Hopper',
    memory_type: 'HBM3e', memory_total_gb: 141, peak_flops: '1979 TFLOPS (FP16)',
    interconnect: 'NVLink 900GB/s', adapter_type: 'dcgm', power_limit_w: 700,
    accent: 'cyan'
  },
  {
    vendor: 'nvidia', model: 'RTX_PRO_5000_BLACKWELL', label: 'RTX PRO 5000 Blackwell', architecture: 'Blackwell',
    memory_type: 'GDDR7 ECC', memory_total_gb: 72, peak_flops: '~700 TFLOPS (FP16)',
    interconnect: 'PCIe Gen5', adapter_type: 'dcgm-subset', power_limit_w: 300,
    accent: 'violet'
  },
  {
    vendor: 'aliyun_ppu', model: 'ZHENWU_810E', label: 'Zhenwu 810E PPU', architecture: 'PPU',
    memory_type: 'HBM', memory_total_gb: 96, peak_flops: 'vendor-normalized',
    interconnect: 'Inter-chip 700GB/s', adapter_type: 'ppu_sdk', power_limit_w: 550,
    accent: 'lime'
  },
  {
    vendor: 'aliyun_ppu', model: 'ZHENWU_M890', label: 'Zhenwu M890 PPU', architecture: 'PPU',
    memory_type: 'HBM', memory_total_gb: 144, peak_flops: 'vendor-normalized',
    interconnect: 'Inter-chip 800GB/s', adapter_type: 'ppu_sdk', power_limit_w: 600,
    accent: 'amber'
  }
]

export const VENDOR_LABEL = {
  nvidia: 'NVIDIA',
  aliyun_ppu: 'Alibaba PPU',
  generic: 'Generic'
}

export const TENANTS = [
  { tenant_id: 'team-foundation', name: 'Foundation Models' },
  { tenant_id: 'team-multimodal', name: 'Multimodal Lab' },
  { tenant_id: 'team-rlhf', name: 'Alignment / RLHF' },
  { tenant_id: 'team-research', name: 'Research' }
]

export const FRAMEWORKS = ['Megatron', 'DeepSpeed', 'FSDP', 'PAI-Megatron']
export const PARALLEL = ['DP', 'TP', 'PP', 'ZeRO-3']

// L0 / L1 metric dictionary subset (PRD §7, §8). Each has tooltip semantics.
export const METRIC_DICTIONARY = [
  {
    metric_id: 'accelerator.utilization.compute.pct', display_name: 'Compute Utilization', unit: '%',
    layer: 'hardware', priority: 'P0', type: 'gauge', default_aggregation: 'time_weighted_avg',
    vendors: ['nvidia', 'aliyun_ppu', 'generic'],
    tooltip: {
      definition: 'Proportion of the sampling window during which accelerator compute units are busy.',
      difference: 'Different from MFU: high utilization means the card is busy, not that model compute is efficient.',
      caveat: 'Vendors define "busy" differently — prefer normalized metrics for cross-model comparison.'
    },
    similar: ['training.mfu.pct', 'accelerator.sm.occupancy.pct']
  },
  {
    metric_id: 'accelerator.memory.used.pct', display_name: 'Memory Utilization', unit: '%',
    layer: 'hardware', priority: 'P0', type: 'gauge', default_aggregation: 'weighted_avg',
    vendors: ['nvidia', 'aliyun_ppu', 'generic'],
    tooltip: {
      definition: 'Used memory / total memory.',
      difference: 'Different from memory bandwidth utilization, which measures throughput pressure rather than capacity.',
      caveat: 'Full memory is not necessarily slow; watch fragmentation for OOM risk.'
    },
    similar: ['accelerator.memory.bandwidth.pct']
  },
  {
    metric_id: 'training.mfu.pct', display_name: 'MFU', unit: '%',
    layer: 'training', priority: 'P1', type: 'gauge', default_aggregation: 'token_weighted',
    vendors: ['nvidia', 'aliyun_ppu'],
    tooltip: {
      definition: 'Actual model FLOPs / theoretical peak FLOPs of the accelerator model.',
      difference: 'Different from GPU utilization (busy/idle) and Tokens/s (throughput affected by batch/seq length).',
      caveat: 'Cross-model comparison requires same-model grouping and precision-aware peak metadata.'
    },
    similar: ['accelerator.utilization.compute.pct', 'training.throughput.tokens']
  },
  {
    metric_id: 'accelerator.temperature.celsius', display_name: 'Temperature', unit: '°C',
    layer: 'hardware', priority: 'P1', type: 'gauge', default_aggregation: 'max',
    vendors: ['nvidia', 'aliyun_ppu', 'generic'],
    tooltip: {
      definition: 'Accelerator die/hotspot temperature.',
      difference: 'Temperature is a state; thermal throttle is the performance-impacting event.',
      caveat: 'Compare against per-model thermal limits, not a global threshold.'
    },
    similar: ['accelerator.thermal.throttle.events']
  },
  {
    metric_id: 'accelerator.power.watt', display_name: 'Power Draw', unit: 'W',
    layer: 'hardware', priority: 'P1', type: 'gauge', default_aggregation: 'avg',
    vendors: ['nvidia', 'aliyun_ppu', 'generic'],
    tooltip: {
      definition: 'Instantaneous board power draw.',
      difference: 'Power-limit hit % indicates capped operation; raw watts do not.',
      caveat: 'Each model has its own power limit (H200 700W, RTX PRO 5000 300W).'
    },
    similar: ['accelerator.power.limit.hit.pct']
  },
  {
    metric_id: 'training.throughput.tokens', display_name: 'Throughput', unit: 'tok/s',
    layer: 'training', priority: 'P1', type: 'gauge', default_aggregation: 'sum',
    vendors: ['nvidia', 'aliyun_ppu'],
    tooltip: {
      definition: 'Aggregated training output in tokens per second.',
      difference: 'Business throughput; affected by batch size, sequence length, and parallel strategy.',
      caveat: 'Compare per-card throughput within the same model + parallel strategy.'
    },
    similar: ['training.mfu.pct']
  },
  {
    metric_id: 'training.wait.communication.pct', display_name: 'Comm Wait Ratio', unit: '%',
    layer: 'training', priority: 'P1', type: 'gauge', default_aggregation: 'avg',
    vendors: ['nvidia', 'aliyun_ppu'],
    tooltip: {
      definition: 'Proportion of a step spent waiting on collective communication or sync barriers.',
      difference: 'Different from raw NCCL AllReduce latency — a single slow op may not block training.',
      caveat: 'High wait ratio means communication is on the critical path.'
    },
    similar: ['training.wait.data.pct']
  },
  {
    metric_id: 'training.wait.data.pct', display_name: 'Data Wait Ratio', unit: '%',
    layer: 'training', priority: 'P1', type: 'gauge', default_aggregation: 'avg',
    vendors: ['nvidia', 'aliyun_ppu', 'generic'],
    tooltip: {
      definition: 'Proportion of a step spent waiting on DataLoader / IO.',
      difference: 'A training-side view; distinct from system IOWait / CPU utilization.',
      caveat: 'High data wait with high memory + low compute points to an input pipeline bottleneck.'
    },
    similar: ['training.wait.communication.pct']
  }
]

export const METRIC_BY_ID = Object.fromEntries(METRIC_DICTIONARY.map((m) => [m.metric_id, m]))

export const TIME_RANGES = [
  { id: '15m', label: 'Last 15m', minutes: 15 },
  { id: '1h', label: 'Last 1h', minutes: 60 },
  { id: '6h', label: 'Last 6h', minutes: 360 },
  { id: '24h', label: 'Last 24h', minutes: 1440 },
  { id: '7d', label: 'Last 7d', minutes: 10080 }
]

export const TABS = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'resources', label: 'Compute Resources', icon: 'Server' },
  { id: 'jobs', label: 'Training Jobs', icon: 'Boxes' },
  { id: 'trends', label: 'Trend Analysis', icon: 'TrendingUp' },
  { id: 'alerts', label: 'Alerts', icon: 'BellRing' },
  { id: 'cost', label: 'Cost & Capacity', icon: 'Wallet' },
  { id: 'settings', label: 'Metrics & Config', icon: 'SlidersHorizontal' }
]
