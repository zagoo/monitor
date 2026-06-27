// Static metadata catalog: regions, accelerator types, tenants, time ranges, tabs.
// The full metric dictionary lives in ./metrics.js and is re-exported here so existing
// imports (`import { METRIC_DICTIONARY } from '../data/catalog.js'`) keep working.

export const REGIONS = [
  { region_id: 'cn-hangzhou', region_name: '杭州', cloud_provider: '阿里云', timezone: 'Asia/Shanghai', status: 'online' },
  { region_id: 'cn-wulanchabu', region_name: '乌兰察布', cloud_provider: '阿里云', timezone: 'Asia/Shanghai', status: 'online' },
  { region_id: 'cn-shenzhen', region_name: '深圳', cloud_provider: '自建', timezone: 'Asia/Shanghai', status: 'degraded' },
  { region_id: 'us-west-2', region_name: '美西', cloud_provider: 'AWS', timezone: 'America/Los_Angeles', status: 'online' }
]

export const ACCELERATOR_TYPES = [
  {
    vendor: 'nvidia', model: 'H200', label: 'NVIDIA H200', architecture: 'Hopper',
    memory_type: 'HBM3e', memory_total_gb: 141, peak_flops: '1979 TFLOPS (FP16)', peak_tflops: 1979,
    interconnect: 'NVLink 900GB/s', adapter_type: 'dcgm', power_limit_w: 700,
    accent: 'cyan'
  },
  {
    vendor: 'nvidia', model: 'RTX_PRO_5000_BLACKWELL', label: 'RTX PRO 5000 Blackwell', architecture: 'Blackwell',
    memory_type: 'GDDR7 ECC', memory_total_gb: 72, peak_flops: '~700 TFLOPS (FP16)', peak_tflops: 700,
    interconnect: 'PCIe Gen5', adapter_type: 'dcgm-subset', power_limit_w: 300,
    accent: 'violet'
  },
  {
    vendor: 'aliyun_ppu', model: 'ZHENWU_810E', label: 'Zhenwu 810E PPU', architecture: 'PPU',
    memory_type: 'HBM', memory_total_gb: 96, peak_flops: 'vendor-normalized', peak_tflops: 1024,
    interconnect: 'Inter-chip 700GB/s', adapter_type: 'ppu_sdk', power_limit_w: 550,
    accent: 'lime'
  },
  {
    vendor: 'aliyun_ppu', model: 'ZHENWU_M890', label: 'Zhenwu M890 PPU', architecture: 'PPU',
    memory_type: 'HBM', memory_total_gb: 144, peak_flops: 'vendor-normalized', peak_tflops: 1312,
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
  { tenant_id: 'team-foundation', name: '基础模型组', quota_cards: 320, budget_pct: 71 },
  { tenant_id: 'team-multimodal', name: '多模态实验室', quota_cards: 160, budget_pct: 58 },
  { tenant_id: 'team-rlhf', name: '对齐 / RLHF', quota_cards: 96, budget_pct: 83 },
  { tenant_id: 'team-research', name: '研究组', quota_cards: 64, budget_pct: 44 }
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
  { id: '15m', label: '近 15 分钟', minutes: 15 },
  { id: '1h', label: '近 1 小时', minutes: 60 },
  { id: '6h', label: '近 6 小时', minutes: 360 },
  { id: '24h', label: '近 24 小时', minutes: 1440 },
  { id: '7d', label: '近 7 天', minutes: 10080 }
]

export const TABS = [
  { id: 'overview', label: '总览', icon: 'LayoutDashboard' },
  { id: 'resources', label: '算力资源', icon: 'Server' },
  { id: 'jobs', label: '训练作业', icon: 'Boxes' },
  { id: 'trends', label: '趋势分析', icon: 'TrendingUp' },
  { id: 'alerts', label: '告警事件', icon: 'BellRing' },
  { id: 'cost', label: '成本与容量', icon: 'Wallet' },
  { id: 'settings', label: '指标与配置', icon: 'SlidersHorizontal' }
]
