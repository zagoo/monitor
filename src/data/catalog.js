// Static metadata catalog: regions, accelerator types, tenants, time ranges, tabs.
// The full metric dictionary lives in ./metrics.js and is re-exported here so existing
// imports (`import { METRIC_DICTIONARY } from '../data/catalog.js'`) keep working.

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

// Full metric dictionary (PRD §7 L0/L1/L2 + §8 confused metrics).
export {
  METRIC_DICTIONARY,
  METRIC_BY_ID,
  LEVELS,
  LEVEL_META,
  LAYER_LABEL,
  metricsByLevel
} from './metrics.js'

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
