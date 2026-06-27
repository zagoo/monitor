// ─────────────────────────────────────────────────────────────────────────────
// 指标字典 · COMPLETE METRIC DICTIONARY
// 覆盖 monitoring_prd_en.md 中提到的每一个指标：
//   · L0 首页核心指标            (§7.2, 12 项)
//   · L1 标准分析指标            (§7.3.1 硬件/系统, §7.3.2 网络/存储, §7.3.3 训练效率与业务运营)
//   · L2 专家诊断指标            (§7.4)
//   · §8.1 需内置 tooltip 的核心指标（定义 + 易混淆对比）
//
// 字段（指标名以中文呈现，并保留权威英文/缩写于 en 字段）：
//   display_name – 中文指标名（保留 MFU / ECC / Xid / NVLink 等业界缩写）
//   en           – 英文原名 / 标准术语
//   def          – 定义       calc – 计算逻辑/公式      sig – 重要性
//   related      – 相关指标 ids   confused – 易混淆指标 [{ name, diff }]   notes – 注意事项
//
// 内容依据权威资料校订：NVIDIA DCGM Field IDs、NVIDIA Xid/动态页面退役、
// NCCL-tests PERFORMANCE.md(busbw)、PaLM/Megatron 的 MFU 口径、Google ML Goodput。
//
// level: L0 | L1 | L2     priority: P0 | P1 | P2 | P3
// layer: hardware | system | k8s | network | storage | comm | training | cost | scheduling | expert
// ─────────────────────────────────────────────────────────────────────────────

const ALL = ['nvidia', 'aliyun_ppu', 'generic']
const NV_PPU = ['nvidia', 'aliyun_ppu']

export const METRIC_DICTIONARY = [
  // ── L0 · 首页核心指标 (§7.2) ─────────────────────────────────────────────────
  {
    metric_id: 'fleet.cards.total', display_name: '加速卡总数', en: 'Total Cards', unit: 'cards',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['inventory', 'kubernetes'],
    def: '当前范围内受管的 AI 加速卡总数。',
    calc: '在当前筛选条件下对 accelerator_id 去重计数（count distinct）。',
    sig: '容量基线——所有利用率、分配率与浪费率都以它为分母进行衡量。',
    related: ['fleet.cards.available', 'fleet.cards.allocated'],
    confused: [{ name: '已分配卡数', diff: '总数统计全部受管卡；已分配仅统计绑定到 Job/Pod 的卡。' }],
    notes: '包含离线/维护中的卡；如需排除请按健康状态筛选。'
  },
  {
    metric_id: 'fleet.cards.available', display_name: '可用卡数 / 可用率', en: 'Available Cards / Availability Rate', unit: 'cards / %',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'count+ratio', vendors: ALL,
    default_aggregation: 'count / ratio', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'kubernetes'],
    def: 'health_status = healthy 的卡数量及其占总数的比例。',
    calc: '健康卡数 / 总卡数 × 100。',
    sig: '面向值班的首要硬件健康信号；可用率下降通常意味着故障增多或正在维护。',
    related: ['fleet.cards.total', 'accelerator.offline.events', 'alerts.p0.count'],
    confused: [{ name: '分配率', diff: '可用率关注硬件是否健康；分配率关注是否被调度占用。' }],
    notes: '处于维护窗口的卡单独统计，不计为不健康。'
  },
  {
    metric_id: 'fleet.cards.allocated', display_name: '已分配卡数 / 分配率', en: 'Allocated Cards / Allocation Rate', unit: 'cards / %',
    level: 'L0', priority: 'P0', layer: 'scheduling', type: 'count+ratio', vendors: ALL,
    default_aggregation: 'count / ratio', sources: ['kubernetes', 'scheduler'],
    def: '已绑定到 Job 或 Pod 的卡数量及其占比。',
    calc: '已分配卡数 / 总卡数 × 100。',
    sig: '调度水位线——衡量工作负载占用了多少算力。',
    related: ['fleet.cards.active', 'sched.fragmentation.pct', 'cost.card_hours'],
    confused: [{ name: '活跃训练卡数', diff: '已分配表示被占用；活跃表示确实在以高于阈值的利用率计算。' }],
    notes: '高分配率叠加低活跃率，是典型的"占而不用"浪费信号。'
  },
  {
    metric_id: 'fleet.cards.active', display_name: '活跃训练卡数', en: 'Active Training Cards', unit: 'cards',
    level: 'L0', priority: 'P0', layer: 'training', type: 'count', vendors: NV_PPU,
    default_aggregation: 'count', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'training_hook'],
    def: '承载训练负载且计算利用率高于活跃阈值的卡。',
    calc: 'count(allocated = true 且 compute_util_pct > 活跃阈值)。',
    sig: '把真正在工作的卡与"已分配但空闲"的卡区分开。',
    related: ['fleet.cards.allocated', 'accelerator.utilization.compute.pct'],
    confused: [{ name: '已分配卡数', diff: '活跃是已分配中确实在计算的子集。' }],
    notes: '默认活跃阈值为 25% 计算利用率，可按采集档位配置。'
  },
  {
    metric_id: 'accelerator.utilization.compute.pct', display_name: '计算利用率', en: 'Compute Utilization (GPU Util)', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'time_weighted_avg', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    scope: ['accelerator', 'pod', 'job', 'region'],
    def: '采样窗口内 GPU 图形/计算引擎处于活跃（至少有一个 kernel 在某个 SM 上执行）的时间占比。',
    calc: '对应 DCGM 的 DCGM_FI_PROF_GR_ENGINE_ACTIVE（优于传统的 DCGM_FI_DEV_GPU_UTIL）；繁忙时间 / 采样时间 × 100，并按厂商适配器归一化。',
    sig: '判断卡"是否在被使用"的第一信号——但繁忙不代表算力被高效利用。',
    related: ['training.mfu.pct', 'expert.sm.occupancy.pct', 'accelerator.utilization.tensor.pct'],
    confused: [
      { name: 'MFU', diff: 'MFU 衡量有效模型算力 / 理论峰值；利用率高 ≠ 模型计算高效。' },
      { name: 'SM/Warp 占用率', diff: '占用率衡量每个 SM 上活跃 warp 的比例，是更细粒度的内核效率指标。' }
    ],
    notes: '传统 DCGM_FI_DEV_GPU_UTIL 为采样式，单个 SM 活跃即可读到接近 100%，易高估；跨型号比较优先用归一化的引擎活跃度并按同型号分组。'
  },
  {
    metric_id: 'accelerator.memory.used.pct', display_name: '显存利用率', en: 'Memory Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    scope: ['accelerator', 'pod', 'job', 'region'],
    def: '已用显存 / 总显存（容量维度的占用）。',
    calc: 'sum(已用显存字节) / sum(总显存字节) × 100；汇总时按卡显存容量加权。',
    sig: '显存压力信号；接近占满会有 OOM 风险并限制可用的批大小。',
    related: ['accelerator.memory.bandwidth.pct', 'expert.memory.fragmentation', 'system.oom.kill.events'],
    confused: [
      { name: '显存带宽利用率', diff: '容量（占多满）与吞吐压力（读写多快）是两回事。' },
      { name: '显存碎片化', diff: '占满不一定慢；高碎片率即便未达 100% 也可能触发 OOM。' }
    ],
    notes: '按显存容量加权汇总，而非在异构型号间做简单平均。'
  },
  {
    metric_id: 'accelerator.memory.bandwidth.pct', display_name: '显存带宽利用率', en: 'Memory Bandwidth Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '实际显存读写带宽 / 理论峰值带宽（对应 DCGM 的 DRAM Active 类指标）。',
    calc: '实测带宽(字节/秒) / 型号峰值带宽(字节/秒) × 100。',
    sig: '即使容量利用率看起来正常，也能发现访存（memory-bound）瓶颈。',
    related: ['accelerator.memory.used.pct', 'accelerator.utilization.compute.pct'],
    confused: [{ name: '显存利用率', diff: '显存利用率是容量；带宽利用率是吞吐压力。' }],
    notes: '峰值带宽元数据与型号相关（H200 4.8 TB/s，RTX PRO 5000 1344 GB/s）。'
  },
  {
    metric_id: 'accelerator.utilization.tensor.pct', display_name: '张量/矩阵单元利用率', en: 'Tensor / Matrix Unit Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'time_weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'Tensor Core / 矩阵乘单元处于活跃状态的时间占比（对应 DCGM Tensor/Pipe Active）。',
    calc: '张量单元活跃周期 / 总周期 × 100。',
    sig: '相比整体计算利用率，更能代表真正有用的矩阵乘（matmul）工作量。',
    related: ['accelerator.utilization.compute.pct', 'training.mfu.pct'],
    confused: [{ name: '计算利用率', diff: '计算利用率统计任意繁忙单元；张量利用率仅隔离矩阵乘引擎。' }],
    notes: '是否可用取决于适配器；PPU 通过 SDK 暴露归一化的等价指标。'
  },
  {
    metric_id: 'fleet.util.compute.avg', display_name: '平均计算利用率', en: 'Average Compute Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'training', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '范围内各卡按采样加权后的平均计算利用率。',
    calc: 'sum(各区域利用率均值 × 区域活跃采样数) / sum(区域活跃采样数)。',
    sig: '面向管理者与 FinOps 的总览级资源使用率。',
    related: ['accelerator.utilization.compute.pct', 'fleet.util.memory.avg'],
    confused: [{ name: '单卡计算利用率', diff: '集群值是加权汇总；绝不能在异构型号间做简单平均。' }],
    notes: '多区域汇总按采样数/卡数加权以避免偏差（§6.2）。'
  },
  {
    metric_id: 'fleet.util.memory.avg', display_name: '平均显存利用率', en: 'Average Memory Utilization', unit: '%',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'weighted_avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '按显存容量加权后的各卡平均显存利用率。',
    calc: 'sum(已用显存字节) / sum(总显存字节) × 100。',
    sig: '全机群显存压力指示器。',
    related: ['accelerator.memory.used.pct'],
    confused: [{ name: '平均计算利用率', diff: '显存是容量压力；计算是繁忙时间。' }],
    notes: '由于型号显存从 48 GB 到 144 GB 不等，必须按显存容量加权。'
  },
  {
    metric_id: 'alerts.p0.count', display_name: 'P0 告警数', en: 'P0 Alerts', unit: 'alerts',
    level: 'L0', priority: 'P0', layer: 'system', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['alert_manager'],
    def: '当前未恢复的 P0（严重）告警数量。',
    calc: 'count(severity = P0 且 status = firing 的告警)。',
    sig: '值班入口——此处任何条目都需立即处理。',
    related: ['accelerator.errors.xid.count', 'accelerator.errors.ecc.count', 'accelerator.offline.events'],
    confused: [{ name: '硬件错误事件', diff: '告警是经过去重/抑制的事件；硬件事件是原始计数器增量。' }],
    notes: '当某卡离线时会抑制其派生告警以降噪（§15.2）。'
  },
  {
    metric_id: 'hw.error.events', display_name: '硬件错误事件', en: 'Hardware Error Events', unit: 'events',
    level: 'L0', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'node_exporter'],
    def: '窗口内 Xid / ECC / 掉卡 / PPU 原生硬件错误事件的总和。',
    calc: 'increase(xid + ecc_uncorrectable + offline + ppu_native_error 计数器) 在时间范围内的增量。',
    sig: '故障定位信号；事故排查时第一时间查看。',
    related: ['accelerator.errors.xid.count', 'accelerator.errors.ecc.count', 'accelerator.offline.events', 'accelerator.errors.ppu_native.code'],
    confused: [{ name: 'P0 告警数', diff: '原始事件增量 vs 去重后的触发告警。' }],
    notes: 'PPU 原生错误码由适配器映射为通用类别；不会把 NVIDIA 专有的 Xid/NVLink 强加到 PPU 上。'
  },
  {
    metric_id: 'fleet.cards.thermal_power_limited', display_name: '温度/功率受限卡数', en: 'Thermal / Power-Limited Cards', unit: 'cards',
    level: 'L0', priority: 'P1', layer: 'hardware', type: 'count', vendors: ALL,
    default_aggregation: 'count', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '触及温度上限、功率上限或发生热降频的卡数量。',
    calc: 'count(thermal_throttle_events > 0 或 power_limit_hit_pct > 阈值)。',
    sig: '性能下降信号——被降频的卡会悄悄拖慢训练。',
    related: ['accelerator.temperature.celsius', 'accelerator.power.limit_hit.pct', 'accelerator.thermal.throttle.events'],
    confused: [{ name: '温度', diff: '温度只是状态；此项统计性能确实被限制（降频/限功率）的卡。' }],
    notes: '各型号上限不同（H200 700 W，RTX PRO 5000 300 W）。'
  },
  {
    metric_id: 'training.throughput.tokens', display_name: '训练吞吐 (Tokens/s)', en: 'Training Throughput (Tokens/s)', unit: 'tok/s',
    level: 'L0', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    scope: ['job', 'accelerator', 'cluster'],
    def: '以每秒处理 token 数衡量的聚合训练产出。',
    calc: 'sum(已处理 token 数) / 已用秒数，跨所选作业聚合。',
    sig: '集群的业务产出——训练实际在产出什么。',
    related: ['training.throughput.samples', 'training.throughput.per_card', 'training.mfu.pct'],
    confused: [{ name: 'MFU', diff: 'Tokens/s 是受批大小/序列长度影响的原始吞吐；MFU 按硬件峰值归一化。' }],
    notes: '仅在相同型号 + 并行策略下比较单卡吞吐才有意义。'
  },
  {
    metric_id: 'topn.low_utilization', display_name: '低利用率 TopN', en: 'Low-Utilization TopN', unit: 'ranking',
    level: 'L0', priority: 'P1', layer: 'cost', type: 'topn', vendors: ALL,
    default_aggregation: 'topn', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'scheduler'],
    def: '计算利用率最低的已分配卡/作业排名。',
    calc: 'rank_bottom_n(compute_util_pct)，限定 allocated = true 且在窗口内持续。',
    sig: '定位算力浪费点以便回收。',
    related: ['fleet.cards.allocated', 'cost.idle_card_hours', 'accelerator.utilization.compute.pct'],
    confused: [{ name: '空闲卡时成本', diff: 'TopN 列出最严重的对象；空闲卡时量化总浪费量。' }],
    notes: '由预设"已分配且 compute < 20% 持续 15m"驱动该列表。'
  },
  {
    metric_id: 'cost.idle_card_hours', display_name: '空闲卡时成本', en: 'Idle Card-Hour Cost', unit: 'card-h / $',
    level: 'L0', priority: 'P1', layer: 'cost', type: 'sum', vendors: ALL,
    default_aggregation: 'sum', sources: ['scheduler', 'billing'],
    def: '未分配或低利用率卡的估算卡时及其折算成本。',
    calc: 'sum(空闲或低利用卡数/区间 × 区间秒数) / 3600 × 卡时单价。',
    sig: '成本治理信号——把闲置的硅片折算成金额。',
    related: ['cost.card_hours', 'topn.low_utilization', 'cost.goodput.pct'],
    confused: [{ name: '卡时', diff: '卡时是总消耗；空闲卡时是其中被浪费的部分。' }],
    notes: '价格模型可配置；无 FinOps 权限的 SRE 可能看到归一化成本指数而非金额（§13.2）。'
  },

  // ── L1 · 硬件与系统 (§7.3.1) ─────────────────────────────────────────────────
  {
    metric_id: 'accelerator.temperature.celsius', display_name: '温度', en: 'Temperature', unit: '°C',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '加速卡核心/热点（hotspot）温度。',
    calc: '采样窗口内 max(传感器温度)。',
    sig: '热降频与散热问题的先行指标。',
    related: ['accelerator.thermal.throttle.events', 'accelerator.power.watt', 'accelerator.cooling.state'],
    confused: [{ name: '热降频事件', diff: '温度是连续状态；降频是离散的、直接影响性能的事件。' }],
    notes: '应对照各型号热限值判断，而非单一全局阈值。'
  },
  {
    metric_id: 'accelerator.power.watt', display_name: '功耗', en: 'Power Draw', unit: 'W',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '板卡瞬时功耗。',
    calc: '窗口内 avg(功耗瓦数)。',
    sig: '能耗/成本驱动因素，也是功率上限与散热分析的输入。',
    related: ['accelerator.power.limit_hit.pct', 'accelerator.temperature.celsius'],
    confused: [{ name: '功率上限命中率', diff: '原始瓦数 vs 卡运行在功率上限的时间占比。' }],
    notes: '各型号功率上限不同；务必相对型号上限来解读。'
  },
  {
    metric_id: 'accelerator.power.limit_hit.pct', display_name: '功率上限命中率', en: 'Power-Limit Hit', unit: '%',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '卡被钳制在功率上限（power cap）的时间占比。',
    calc: '处于功率上限的时间 / 总时间 × 100。',
    sig: '表明性能正受功率（而非负载）所制约。',
    related: ['accelerator.power.watt', 'accelerator.thermal.throttle.events'],
    confused: [{ name: '功耗', diff: '命中率衡量是否被钳制；瓦数衡量功耗水平。' }],
    notes: '持续高命中率需排查供电/散热。'
  },
  {
    metric_id: 'accelerator.thermal.throttle.events', display_name: '热降频事件', en: 'Thermal Throttle Event', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '因热策略导致设备降频或限功率的事件/频次。',
    calc: 'increase(降频事件计数器) 在窗口内的增量。',
    sig: '训练悄然变慢的直接原因。',
    related: ['accelerator.temperature.celsius', 'accelerator.power.limit_hit.pct'],
    confused: [{ name: '温度', diff: '高温是状态；热降频是真正影响性能的事件。' }],
    notes: '告警模板在 throttle_events > 0 持续 5m 时触发（P1）。'
  },
  {
    metric_id: 'accelerator.cooling.state', display_name: '风扇/液冷状态', en: 'Fan / Liquid-Cooling State', unit: 'state',
    level: 'L1', priority: 'P2', layer: 'hardware', type: 'state', vendors: ALL,
    default_aggregation: 'last', sources: ['node_exporter', 'bmc'],
    def: '风扇或液冷回路的运行状态。',
    calc: '从 BMC / node exporter 读取的离散状态（正常 | 降级 | 故障）。',
    sig: '当整机或整机柜温度升高时的根因上下文。',
    related: ['accelerator.temperature.celsius'],
    confused: [],
    notes: '属机柜/节点级别；诊断时与同机位的卡关联分析。'
  },
  {
    metric_id: 'accelerator.errors.xid.count', display_name: 'Xid 错误', en: 'Xid Errors', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ['nvidia'],
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml'],
    def: 'NVIDIA 驱动上报的 Xid 硬件/驱动错误事件（如 Xid 48 双比特 ECC、Xid 31 显存访问故障、Xid 63/64 页面退役）。',
    calc: 'increase(xid 错误计数器) 在窗口内的增量，可按 Xid 码分组。',
    sig: '强故障信号；如 Xid 48 之后常级联出 Xid 31，应将该卡排空（drain）并送修。',
    related: ['accelerator.errors.ecc.count', 'accelerator.offline.events', 'hw.error.events'],
    confused: [{ name: 'ECC 错误', diff: 'Xid 广泛涵盖驱动/硬件故障；ECC 专指显存位翻转错误。' }],
    notes: '仅限 NVIDIA；PPU 故障改由 ppu_native 错误码上报。'
  },
  {
    metric_id: 'accelerator.errors.ecc.count', display_name: 'ECC 错误', en: 'ECC Errors', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml', 'ppu_sdk_exporter'],
    def: '显存 ECC 可纠正（单比特 SBE）与不可纠正（双比特 DBE）错误计数。',
    calc: 'increase(ecc_correctable) 与 increase(ecc_uncorrectable)；同一地址 2 次 SBE 或 1 次 DBE 会触发动态页面退役（Xid 63 成功 / 64 失败）。',
    sig: '不可纠正 ECC（对应 Xid 48）意味着数据已损坏——应隔离并下线该卡。',
    related: ['accelerator.errors.xid.count', 'accelerator.memory.used.pct'],
    confused: [{ name: 'Xid 错误', diff: 'ECC 专指显存位错误；Xid 是更宽泛的故障类别。' }],
    notes: '不可纠正 ECC 增量 > 0 为 P0 告警；页面退役需开启 ECC。'
  },
  {
    metric_id: 'accelerator.offline.events', display_name: '掉卡（离线）事件', en: 'Offline Card Events', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'hardware', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'ppu_sdk_exporter', 'kubernetes'],
    def: '设备掉出总线 / 停止上报的事件（fall off the bus）。',
    calc: 'increase(设备离线计数器) 在窗口内的增量。',
    sig: '硬故障信号；离线卡会阻塞调度到其上的任何作业。',
    related: ['fleet.cards.available', 'accelerator.errors.xid.count'],
    confused: [{ name: '采集过期 (stale)', diff: '离线是硬件掉线；过期是 exporter/数据新鲜度问题。' }],
    notes: '离线卡告警会抑制同卡的派生低利用/缺温度告警。'
  },
  {
    metric_id: 'accelerator.link.nvlink_pcie.errors', display_name: 'NVLink/PCIe 错误', en: 'NVLink / PCIe Errors', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ['nvidia'],
    default_aggregation: 'increase', sources: ['dcgm_exporter', 'nvml'],
    def: 'NVLink、NVSwitch 或 PCIe 链路上的重传 / CRC / 链路错误。',
    calc: 'increase(链路错误计数器) 在窗口内的增量。',
    sig: '节点内互连故障会降低集合通信性能。',
    related: ['network.nvlink.bandwidth', 'comm.allreduce.duration.ms'],
    confused: [{ name: '节点间误码', diff: '这些是主机内链路；误码是在 RoCE/IB 网络上。' }],
    notes: 'PPU 通过其自有适配器字段暴露片间链路错误。'
  },
  {
    metric_id: 'accelerator.errors.ppu_native.code', display_name: 'PPU 原生错误码', en: 'PPU-Native Error Code', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'hardware', type: 'increase', vendors: ['aliyun_ppu'],
    default_aggregation: 'increase', sources: ['ppu_sdk_exporter'],
    def: '由真武 PPU SDK 上报的厂商原生错误码。',
    calc: 'increase(ppu 原生错误计数器) 按错误码分组。',
    sig: 'PPU 上等价于 Xid/ECC 的故障定位手段。',
    related: ['hw.error.events', 'accelerator.errors.ecc.count'],
    confused: [{ name: 'Xid 错误', diff: 'PPU 错误码存于 adapter_specific 并映射为通用类别；不会把 NVIDIA Xid 强加到 PPU。' }],
    notes: '原始码保存在 adapter_specific 中，并归一化为通用硬件错误类别。'
  },
  {
    metric_id: 'system.cpu.utilization.pct', display_name: 'CPU 利用率', en: 'CPU Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter', 'kubelet'],
    def: '节点/Pod 的主机 CPU 利用率。',
    calc: '繁忙 CPU 时间 / 总 CPU 时间 × 100。',
    sig: 'CPU 过高会拖慢数据输入流水线与主机侧集合通信。',
    related: ['system.cpu.iowait.pct', 'training.wait.data.pct'],
    confused: [{ name: '计算利用率', diff: '这是主机 CPU；计算利用率指的是加速卡。' }],
    notes: '诊断输入瓶颈时与 DataLoader 耗时关联分析。'
  },
  {
    metric_id: 'system.cpu.iowait.pct', display_name: 'IO 等待 (IOWait)', en: 'IOWait', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter'],
    def: 'CPU 等待 I/O 完成的时间占比。',
    calc: 'iowait CPU 时间 / 总 CPU 时间 × 100。',
    sig: '从系统层面观察喂给训练的存储/IO 压力。',
    related: ['training.wait.data.pct', 'dataloader.iteration.ms'],
    confused: [{ name: 'DataLoader 迭代耗时', diff: 'IOWait 是系统视角；DataLoader 耗时是训练循环视角。' }],
    notes: '高 IOWait 叠加高 DataLoader 耗时，可确认输入流水线瓶颈。'
  },
  {
    metric_id: 'system.memory.used.pct', display_name: '系统内存利用率', en: 'System Memory', unit: '%',
    level: 'L1', priority: 'P1', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['node_exporter', 'kubelet'],
    def: '主机内存（RAM）利用率。',
    calc: '已用字节 / 总字节 × 100。',
    sig: '主机内存压力是训练 Pod 发生 OOM 的前兆。',
    related: ['system.oom.kill.events', 'system.numa.imbalance'],
    confused: [{ name: '设备显存利用率', diff: '这是主机内存，而非加速卡 HBM 显存。' }],
    notes: '对大型数据流水线，按 NUMA 感知限制进行绑定。'
  },
  {
    metric_id: 'system.numa.imbalance', display_name: 'NUMA 不均衡', en: 'NUMA Imbalance', unit: 'ratio',
    level: 'L1', priority: 'P2', layer: 'system', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['node_exporter'],
    def: '各 NUMA 节点之间内存/CPU 使用的不均衡程度。',
    calc: '各 NUMA 域 max(节点使用) / mean(节点使用)。',
    sig: 'NUMA 不均衡会损害主机到设备的拷贝与 DataLoader 吞吐。',
    related: ['system.memory.used.pct', 'dataloader.copy.h2d'],
    confused: [],
    notes: '通过 NUMA 绑核 worker 与内存亲和性来缓解。'
  },
  {
    metric_id: 'system.oom.kill.events', display_name: 'OOM 击杀', en: 'OOM Kill', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'system', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kubelet', 'node_exporter'],
    def: '容器/进程因内存溢出被击杀的事件。',
    calc: 'increase(oom_kill 计数器) 在窗口内的增量。',
    sig: '会突然终止训练；是无法解释的重启的主要原因之一。',
    related: ['system.memory.used.pct', 'k8s.pod.restarts', 'expert.memory.fragmentation'],
    confused: [{ name: '设备 OOM', diff: '主机 OOM 击杀进程；设备 OOM 是框架内的 HBM 分配失败。' }],
    notes: '结合分配器细节（专家级）区分内存泄漏与真实超额分配。'
  },
  {
    metric_id: 'k8s.pod.pending.seconds', display_name: 'Pod 等待调度时长', en: 'Pod Pending Time', unit: 's',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['kube_state_metrics'],
    def: 'Pod 在被成功调度前处于 Pending 的时长。',
    calc: '调度时间 − 创建时间，汇总为 P50/P95。',
    sig: 'Pending 时间长意味着容量不足或资源碎片化。',
    related: ['sched.queue.time', 'sched.fragmentation.pct', 'k8s.schedule.failures'],
    confused: [{ name: '排队时长', diff: 'Pending 是 K8s 放置层面的等待；排队时长是调度器/配额层面的等待。' }],
    notes: 'P95 > SLO 持续 15m 触发排队积压告警。'
  },
  {
    metric_id: 'k8s.schedule.failures', display_name: '调度失败', en: 'Scheduling Failures', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kube_state_metrics', 'scheduler'],
    def: '调度失败次数（unschedulable 事件）。',
    calc: 'increase(调度失败计数器) 在窗口内的增量。',
    sig: '暴露阻碍 Pod 放置的拓扑/配额/亲和性约束。',
    related: ['sched.fragmentation.pct', 'k8s.pod.pending.seconds'],
    confused: [{ name: '资源碎片率', diff: '失败是症状；碎片化是常见原因。' }],
    notes: '对失败原因分组以区分配额、拓扑与亲和性。'
  },
  {
    metric_id: 'k8s.pod.restarts', display_name: 'Pod 重启次数', en: 'Pod Restarts', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'k8s', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['kube_state_metrics'],
    def: '训练 Pod 的容器重启次数。',
    calc: 'increase(容器重启计数) 在窗口内的增量。',
    sig: '频繁重启意味着崩溃、OOM 或硬件抖动。',
    related: ['k8s.pod.exit_code', 'system.oom.kill.events'],
    confused: [],
    notes: '结合退出码以归类故障模式。'
  },
  {
    metric_id: 'k8s.pod.exit_code', display_name: '退出码', en: 'Exit Code', unit: 'code',
    level: 'L1', priority: 'P2', layer: 'k8s', type: 'state', vendors: ALL,
    default_aggregation: 'last', sources: ['kube_state_metrics'],
    def: '容器最近一次终止的退出码。',
    calc: '由 kubelet 在容器退出时上报。',
    sig: '用于归类 Pod 停止的原因（OOM 137、错误 1 等）。',
    related: ['k8s.pod.restarts', 'system.oom.kill.events'],
    confused: [],
    notes: '137 通常表示被 OOM 击杀；0 为正常关闭。'
  },
  {
    metric_id: 'k8s.resource.request_limit', display_name: '资源 Requests/Limits', en: 'Resource Requests / Limits', unit: 'ratio',
    level: 'L1', priority: 'P2', layer: 'k8s', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['kube_state_metrics'],
    def: '配置的 CPU/内存/加速卡 requests 与 limits 相对实际使用的比例。',
    calc: '各资源的 实际使用 / requested（以及 / limit）。',
    sig: 'request 过高会造成碎片化；request 不足会被限流或 OOM。',
    related: ['sched.fragmentation.pct', 'system.memory.used.pct'],
    confused: [],
    notes: 'FinOps 进行资源规格优化（right-sizing）的关键输入。'
  },

  // ── L1 · 网络与存储 (§7.3.2) ─────────────────────────────────────────────────
  {
    metric_id: 'network.nvlink.bandwidth', display_name: 'NVLink/NVSwitch/PCIe 带宽', en: 'NVLink / NVSwitch / PCIe Bandwidth', unit: 'GB/s',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: 'NVLink/NVSwitch/PCIe（或 PPU 片间链路）上的节点内互连带宽。',
    calc: '各链路 实测字节/秒，按节点求和/平均。',
    sig: '决定节点内各卡之间梯度传输的速度上限。',
    related: ['accelerator.link.nvlink_pcie.errors', 'comm.bandwidth.efficiency.pct'],
    confused: [{ name: '节点间网络带宽', diff: '这是主机内链路；网络带宽是跨 RoCE/IB 网络。' }],
    notes: 'PPU 片间互连（700/800 GB/s）通过 PPU 适配器上报。'
  },
  {
    metric_id: 'network.intra.link_status', display_name: '节点内链路状态/错误', en: 'Intra-Node Link Status / Errors', unit: 'state',
    level: 'L1', priority: 'P1', layer: 'network', type: 'state', vendors: NV_PPU,
    default_aggregation: 'last', sources: ['dcgm_exporter', 'ppu_sdk_exporter'],
    def: '节点内链路的 up/down/降级状态及错误计数。',
    calc: '离散链路状态加 increase(链路错误计数器)。',
    sig: '降级链路会悄悄使有效互连带宽减半。',
    related: ['network.nvlink.bandwidth', 'accelerator.link.nvlink_pcie.errors'],
    confused: [],
    notes: '与集合通信延迟尖峰关联分析。'
  },
  {
    metric_id: 'network.fabric.bandwidth', display_name: 'RoCE/IB 带宽', en: 'RoCE / IB Bandwidth', unit: 'Gb/s',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['network_exporter'],
    def: '通过 RoCE 或 InfiniBand 的节点间网络带宽。',
    calc: '各 NIC/端口 实测收发字节/秒。',
    sig: '决定多节点训练的可扩展性。',
    related: ['network.fabric.pfc_ecn', 'network.latency.p99.us', 'comm.bandwidth.efficiency.pct'],
    confused: [{ name: 'NVLink 带宽', diff: '网络是节点之间；NVLink 是节点内部。' }],
    notes: 'fabric_id/nic_id 标签使跨网络结果保持分离。'
  },
  {
    metric_id: 'network.fabric.pfc_ecn', display_name: 'PFC/ECN', en: 'PFC / ECN', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: '优先级流控（PFC）暂停帧与 ECN 拥塞标记。',
    calc: 'increase(pfc 暂停帧) 与 increase(ecn 标记报文)。',
    sig: '高 PFC/ECN 意味着网络拥塞，会拖住集合通信。',
    related: ['network.fabric.bandwidth', 'training.wait.communication.pct'],
    confused: [{ name: '误码', diff: 'PFC/ECN 是拥塞控制；误码是物理层损坏。' }],
    notes: '持续暂停意味着需要进行拓扑或 QoS 调优。'
  },
  {
    metric_id: 'network.port.down.events', display_name: '端口宕机', en: 'Port Down', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: 'NIC/交换机端口 down/抖动事件。',
    calc: 'increase(端口 down 计数器) 在窗口内的增量。',
    sig: '端口宕掉会把节点移出集合通信组，使作业卡住。',
    related: ['network.fabric.bandwidth', 'network.bit.errors'],
    confused: [],
    notes: '常是通信等待突然飙升的根因。'
  },
  {
    metric_id: 'network.bit.errors', display_name: '误码（位错误）', en: 'Bit Errors', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'network', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['network_exporter'],
    def: '网络链路上的物理层位/符号错误计数。',
    calc: 'increase(符号错误计数器) 在窗口内的增量。',
    sig: '误码上升是端口抖动与重传风暴的前兆。',
    related: ['network.port.down.events', 'expert.ebpf.syscall'],
    confused: [{ name: 'PFC/ECN', diff: '误码是物理层损坏；PFC/ECN 是拥塞信令。' }],
    notes: '检查问题端口的线缆/光模块。'
  },
  {
    metric_id: 'network.latency.p99.us', display_name: '网络 P99 延迟', en: 'Network P99 Latency', unit: 'µs',
    level: 'L1', priority: 'P1', layer: 'network', type: 'gauge', vendors: ALL,
    default_aggregation: 'p99', sources: ['network_exporter'],
    def: '节点间网络的尾部（P99）延迟。',
    calc: '窗口内 p99(往返延迟)。',
    sig: '尾延迟主导同步集合通信的性能。',
    related: ['comm.allreduce.duration.ms', 'network.fabric.pfc_ecn'],
    confused: [{ name: '集合通信延迟', diff: '网络延迟是链路级；集合通信延迟是整个 AllReduce 等操作端到端。' }],
    notes: '用 P99 而非平均值——平均会掩盖阻塞同步的离群者。'
  },
  {
    metric_id: 'comm.allreduce.duration.ms', display_name: '集合通信延迟', en: 'Collective Communication Latency', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'comm', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['nccl', 'training_hook'],
    def: 'AllReduce / AllGather / ReduceScatter 等集合操作的延迟。',
    calc: '由框架 hook / NCCL 捕获的每次集合操作时长的 p50/p95/p99。',
    sig: '分布式训练的核心开销；慢集合会拖慢每一步。',
    related: ['comm.bandwidth.efficiency.pct', 'training.wait.communication.pct', 'network.latency.p99.us'],
    confused: [{ name: '通信等待占比', diff: '单次慢操作未必有影响；等待占比才反映它是否阻塞训练。' }],
    notes: '仅对异常作业开启 NCCL 调试（专家级）以避免日志泛滥。'
  },
  {
    metric_id: 'comm.bandwidth.efficiency.pct', display_name: '通信带宽效率', en: 'Communication Bandwidth Efficiency (busbw)', unit: '%',
    level: 'L1', priority: 'P1', layer: 'comm', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['nccl', 'training_hook'],
    def: '实测总线带宽（busbw）/ 硬件峰值带宽（NCCL-tests 口径）。',
    calc: '由算法带宽 algbw=数据量/耗时 校正得到 busbw（AllReduce 为 algbw × 2(n−1)/n），再除以 NVLink/PCIe/网络硬件峰值 × 100。',
    sig: '可独立于卡数反映集合通信对硬件的利用充分程度；偏低提示 NCCL 算法/拓扑欠优或存在争用。',
    related: ['comm.allreduce.duration.ms', 'network.nvlink.bandwidth'],
    confused: [{ name: 'RoCE/IB 带宽', diff: '效率是相对峰值的比率；带宽是绝对速率。' }],
    notes: '在相同并行策略下比较；算法选择（Ring/Tree）会改变可达上限。'
  },
  {
    metric_id: 'training.wait.communication.pct', display_name: '通信等待占比', en: 'Communication Wait Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'nccl'],
    scope: ['job', 'node'],
    def: '一个 step 中等待集合通信或同步屏障的时间占比。',
    calc: '通信等待时间 / step 时间 × 100。',
    sig: '判断通信是否处于 step 的关键路径上。',
    related: ['comm.allreduce.duration.ms', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: 'NCCL AllReduce 延迟', diff: '单次慢操作未必影响整体训练；高等待占比意味着它在阻塞训练。' }],
    notes: '> 30% 持续 10m 触发通信瓶颈告警。'
  },
  {
    metric_id: 'dataloader.iteration.ms', display_name: 'DataLoader 迭代耗时', en: 'DataLoader Iteration Time', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['dataloader_hook'],
    def: '每个 step 用于读取、解码与预处理数据的耗时。',
    calc: '每次迭代 DataLoader 时长的 p50/p95。',
    sig: '继通信之后最常见的隐性训练瓶颈。',
    related: ['training.wait.data.pct', 'dataloader.prefetch.queue', 'system.cpu.iowait.pct'],
    confused: [
      { name: 'IOWait', diff: 'DataLoader 耗时是训练循环视角；IOWait 是系统视角。' },
      { name: 'CPU 利用率', diff: '高 CPU 可能导致 DataLoader 变慢，但二者衡量不同对象。' }
    ],
    notes: 'p95 > 基线 × 1.2 标记为数据瓶颈。'
  },
  {
    metric_id: 'dataloader.prefetch.queue', display_name: '预取队列深度', en: 'Prefetch Queue Depth', unit: 'items',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['dataloader_hook'],
    def: '喂给训练循环的输入预取队列深度。',
    calc: '窗口内 avg(已排队批次数)。',
    sig: '队列长期为空意味着加载器跟不上设备速度。',
    related: ['dataloader.iteration.ms', 'training.wait.data.pct'],
    confused: [],
    notes: '队列枯竭时增加 worker 数或预取因子。'
  },
  {
    metric_id: 'dataloader.copy.h2d', display_name: '主机到设备拷贝 (H2D)', en: 'CPU→GPU/PPU Copy', unit: 'ms',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['dataloader_hook', 'profiler'],
    def: '每个 step 主机到设备（H2D）的内存拷贝耗时。',
    calc: 'p95(主机到设备拷贝毫秒)。',
    sig: '大拷贝与计算重叠不佳，会拉长 step 时间。',
    related: ['dataloader.iteration.ms', 'system.numa.imbalance'],
    confused: [],
    notes: '使用锁页内存（pinned）与 NUMA 本地暂存以减少耗时。'
  },
  {
    metric_id: 'training.wait.data.pct', display_name: '数据等待占比', en: 'Data Wait Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['training_hook', 'dataloader_hook'],
    scope: ['job', 'accelerator'],
    def: '一个 step 中等待数据（DataLoader / IO）的时间占比。',
    calc: '数据等待时间 / step 时间 × 100。',
    sig: '量化输入流水线对设备的"饿死"程度。',
    related: ['dataloader.iteration.ms', 'system.cpu.iowait.pct', 'training.wait.communication.pct'],
    confused: [{ name: 'IOWait', diff: '数据等待是训练视角；IOWait/CPU 是系统视角。' }],
    notes: '高显存 + 低计算 + 高数据等待，是典型的输入瓶颈特征。'
  },
  {
    metric_id: 'checkpoint.save.seconds', display_name: 'Checkpoint 保存/恢复耗时', en: 'Checkpoint Save / Restore Time', unit: 's',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['checkpoint_hook'],
    def: '保存或恢复一个 checkpoint 的耗时。',
    calc: '每次事件的 max(保存时长) 与 max(恢复时长)。',
    sig: '长时间的同步保存会卡住所有 rank；恢复耗时影响故障恢复 RTO。',
    related: ['checkpoint.write.bandwidth', 'checkpoint.file.size_gb', 'checkpoint.async.queue_depth'],
    confused: [],
    notes: '优先采用异步/分片 checkpoint 以隐藏保存延迟。'
  },
  {
    metric_id: 'checkpoint.file.size_gb', display_name: 'Checkpoint 文件大小', en: 'Checkpoint File Size', unit: 'GB',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'last', sources: ['checkpoint_hook'],
    def: '最近一次 checkpoint 的大小。',
    calc: 'sum(各分片字节) / 1e9。',
    sig: '决定保存时间、存储成本与恢复 RTO。',
    related: ['checkpoint.save.seconds', 'checkpoint.write.bandwidth'],
    confused: [],
    notes: '随模型 + 优化器状态增长；分片可在各 rank 间分摊。'
  },
  {
    metric_id: 'checkpoint.write.bandwidth', display_name: 'Checkpoint 写带宽', en: 'Checkpoint Write Bandwidth', unit: 'GB/s',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['checkpoint_hook', 'storage_exporter'],
    def: '写入 checkpoint 时达到的吞吐。',
    calc: 'checkpoint 字节数 / 保存秒数。',
    sig: '写带宽低会拉长停顿，也可能意味着存储争用。',
    related: ['checkpoint.save.seconds', 'checkpoint.file.size_gb'],
    confused: [],
    notes: '对照存储后端上限与并发写入者进行评估。'
  },
  {
    metric_id: 'checkpoint.async.queue_depth', display_name: 'Checkpoint 异步队列深度', en: 'Checkpoint Async Queue Depth', unit: 'items',
    level: 'L1', priority: 'P2', layer: 'storage', type: 'gauge', vendors: ALL,
    default_aggregation: 'max', sources: ['checkpoint_hook'],
    def: '异步 checkpoint 队列中待写入的数量。',
    calc: 'max(异步写队列长度)。',
    sig: '队列增长意味着保存跟不上，可能很快转为阻塞。',
    related: ['checkpoint.write.bandwidth', 'checkpoint.failures'],
    confused: [],
    notes: '此处的反压最终会把异步保存变为阻塞保存。'
  },
  {
    metric_id: 'checkpoint.failures', display_name: 'Checkpoint 失败次数', en: 'Checkpoint Failures', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'storage', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['checkpoint_hook'],
    def: 'checkpoint 保存/恢复失败的次数。',
    calc: 'increase(checkpoint 失败计数器)。',
    sig: '失败的 checkpoint 在崩溃时有丢失训练进度的风险。',
    related: ['checkpoint.save.seconds', 'k8s.pod.restarts'],
    confused: [],
    notes: '与存储错误和 Pod 重启关联分析。'
  },

  // ── L1 · 训练效率与业务运营 (§7.3.3) ────────────────────────────────────────
  {
    metric_id: 'training.step.time.ms', display_name: 'Step 耗时', en: 'Step Time', unit: 'ms',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'p95', sources: ['training_hook'],
    scope: ['job'],
    def: '每个训练 step 的墙钟耗时，汇总为 P50/P95/P99。',
    calc: '来自框架 hook 的每步时长百分位。',
    sig: '核心效率指标；其余指标都在解释它的构成。',
    related: ['training.step.breakdown', 'training.throughput.tokens', 'training.wait.communication.pct'],
    confused: [{ name: '吞吐', diff: 'Step 耗时是每次迭代的延迟；吞吐还折入了批大小/序列长度。' }],
    notes: '基线偏离告警：step 耗时 > 同作业历史 P95 × 1.2。'
  },
  {
    metric_id: 'training.step.breakdown', display_name: 'Step 耗时分解', en: 'Step-Time Breakdown', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'composite', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    scope: ['job'],
    def: '将一个 step 分解为前向、反向、优化器、通信、数据加载、checkpoint 与空闲/屏障。',
    calc: '由 hook + profiler 插桩得到的 各阶段时间 / step 时间 × 100。',
    sig: '把"作业慢"变成"哪个阶段慢"——核心诊断路径。',
    related: ['training.step.time.ms', 'training.wait.communication.pct', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: '空闲/屏障', diff: '空闲是结果阶段；通信/数据等待是 step 内的成因阶段。' }],
    notes: '阶段：前向、反向、优化器、通信、数据加载、Checkpoint、空闲/屏障。'
  },
  {
    metric_id: 'training.throughput.samples', display_name: '吞吐 (Samples/s)', en: 'Throughput (Samples/s)', unit: 'samples/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    def: '每秒处理的样本数。',
    calc: 'sum(样本数) / 已用秒数。',
    sig: '面向非 token 负载（视觉、音频、多模态）的吞吐视角。',
    related: ['training.throughput.tokens', 'training.throughput.per_card'],
    confused: [{ name: 'Tokens/s', diff: 'Samples/s 与 token 级吞吐；按模态选择。' }],
    notes: '与 Tokens/s 比较时按序列长度归一化。'
  },
  {
    metric_id: 'training.throughput.per_card', display_name: '单卡吞吐', en: 'Per-Card Throughput', unit: 'tok/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook'],
    def: '归属到单张加速卡的吞吐。',
    calc: '作业吞吐 / 活跃卡数。',
    sig: '揭示掉队卡（straggler）与单卡效率差异。',
    related: ['training.throughput.tokens', 'training.mfu.pct'],
    confused: [{ name: '集群总吞吐', diff: '单卡按卡数归一化；集群总量是聚合值。' }],
    notes: '仅在相同型号 + 并行策略下比较。'
  },
  {
    metric_id: 'training.throughput.cluster', display_name: '集群总吞吐', en: 'Cluster Total Throughput', unit: 'tok/s',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'sum', sources: ['training_hook'],
    def: '范围内所有训练作业的聚合吞吐。',
    calc: 'sum(各作业吞吐) 跨筛选集合。',
    sig: '用于容量与趋势报告的集群顶层产出。',
    related: ['training.throughput.tokens', 'training.throughput.per_card'],
    confused: [],
    notes: '按区域/型号汇总以公平比较集群。'
  },
  {
    metric_id: 'training.mfu.pct', display_name: 'MFU 模型算力利用率', en: 'MFU · Model FLOPs Utilization', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'token_weighted', sources: ['training_hook'],
    scope: ['job', 'accelerator'],
    def: '模型有效算力 / 加速卡理论峰值算力（源自 PaLM 论文，是业界训练效率的核心口径）。',
    calc: '模型每步 FLOPs / (型号在该精度下的峰值 FLOPs × step 时间 × 卡数) × 100；分子只计模型前向+反向的解析 FLOPs。',
    sig: '衡量训练效率最真实的指标——你究竟用上了多少硅片算力。2026 年预训练 40–60% 为良好，50%+ 为优秀。',
    related: ['training.achieved.tflops', 'accelerator.utilization.compute.pct', 'training.throughput.tokens'],
    confused: [
      { name: 'GPU 利用率', diff: 'GPU 利用率反映繁忙/空闲；MFU 反映有效模型计算效率。' },
      { name: 'HFU 硬件算力利用率', diff: 'HFU 把激活重算等额外计算也计入分子，因此 HFU ≥ MFU。' },
      { name: 'Tokens/s', diff: 'Tokens/s 是受批大小、序列长度与并行策略影响的业务吞吐。' }
    ],
    notes: '需要模型 FLOPs 与精度感知的峰值元数据；不要跨型号平均——使用 token/step 加权。GPU 高利用但 MFU 低，通常意味着内核效率低、通信/数据等待、padding 浪费或并行策略不当。'
  },
  {
    metric_id: 'training.achieved.tflops', display_name: '实测 TFLOPS', en: 'Achieved TFLOPS', unit: 'TFLOPS',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    def: '实际交付给模型的浮点算力吞吐。',
    calc: '模型 FLOPs / 已用秒数 / 1e12。',
    sig: 'MFU 的绝对值搭档，用于矩阵乘效率分析。',
    related: ['training.mfu.pct', 'accelerator.utilization.tensor.pct'],
    confused: [{ name: 'MFU', diff: 'TFLOPS 是绝对值；MFU 是相对硬件峰值的比率。' }],
    notes: '精度很关键——请与 FP16/BF16/FP8 峰值一并标注。'
  },
  {
    metric_id: 'accelerator.idle.pct', display_name: 'GPU/PPU 空闲占比', en: 'GPU/PPU Idle Time', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'profiler'],
    def: '一个 step 中设备没有有效内核/算子执行的时间占比。',
    calc: '空闲时间 / step 时间 × 100。',
    sig: '量化被浪费的设备时间；是各等待占比所要解释的"症状"。',
    related: ['training.wait.communication.pct', 'training.wait.data.pct', 'training.wait.barrier.pct'],
    confused: [{ name: '通信/数据等待', diff: '空闲是结果；通信与数据等待是其成因分解。' }],
    notes: '在优化前先把空闲拆解为各成因。'
  },
  {
    metric_id: 'training.wait.barrier.pct', display_name: '同步屏障等待占比', en: 'Synchronization Barrier Wait', unit: '%',
    level: 'L1', priority: 'P1', layer: 'training', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook'],
    def: '一个 step 中在同步屏障处等待最慢 rank 的时间占比。',
    calc: '屏障等待时间 / step 时间 × 100。',
    sig: '暴露拖累整个作业的掉队卡/节点。',
    related: ['training.wait.communication.pct', 'accelerator.idle.pct'],
    confused: [{ name: '通信等待', diff: '屏障等待是掉队者引发的同步停顿；通信等待是集合传输本身的时间。' }],
    notes: '交叉对照加速卡偏差矩阵以定位掉队者。'
  },
  {
    metric_id: 'training.loss.spike', display_name: 'Loss 尖峰', en: 'Loss Spike', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: '检测到的训练 loss 突增。',
    calc: 'loss > 滑动均值 + k × 滑动标准差（尖峰检测器）。',
    sig: '发散、坏数据或学习率问题的早期预警。',
    related: ['training.nan_inf.events', 'training.gradient.anomaly', 'training.lr.anomaly'],
    confused: [],
    notes: '叠加在 loss 曲线与 step 时间线上查看上下文。'
  },
  {
    metric_id: 'training.nan_inf.events', display_name: 'NaN / Inf', en: 'NaN / Inf', unit: 'events',
    level: 'L1', priority: 'P0', layer: 'training', type: 'increase', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: 'loss/梯度/激活中出现 NaN 或 Inf 的次数。',
    calc: 'increase(nan_inf 计数器) 在窗口内的增量。',
    sig: '会破坏训练；通常需要回滚到 checkpoint。',
    related: ['training.loss.spike', 'training.gradient.anomaly'],
    confused: [],
    notes: '常见于 FP16 溢出——考虑 loss scaling 或改用 BF16。'
  },
  {
    metric_id: 'training.gradient.anomaly', display_name: '梯度爆炸/消失', en: 'Gradient Explosion / Vanishing', unit: 'events',
    level: 'L1', priority: 'P1', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: '梯度范数越过爆炸或消失阈值。',
    calc: 'grad_norm > 高阈值 或 < 低阈值。',
    sig: '表明训练不稳定，需要梯度裁剪或调整学习率。',
    related: ['training.loss.spike', 'training.lr.anomaly', 'training.nan_inf.events'],
    confused: [],
    notes: '关注梯度范数的趋势，而不仅是阈值穿越。'
  },
  {
    metric_id: 'training.lr.anomaly', display_name: '学习率异常', en: 'Learning-Rate Anomaly', unit: 'events',
    level: 'L1', priority: 'P2', layer: 'training', type: 'event', vendors: NV_PPU,
    default_aggregation: 'increase', sources: ['training_hook'],
    def: '学习率取值或调度偏离预期曲线。',
    calc: 'lr 偏离配置的调度超过容差。',
    sig: '配置错误的调度会悄悄破坏收敛。',
    related: ['training.loss.spike', 'training.gradient.anomaly'],
    confused: [],
    notes: '将学习率调度与 loss 曲线叠加以校验。'
  },
  {
    metric_id: 'cost.card_hours', display_name: '卡时', en: 'Card-Hours', unit: 'card-h',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'sum', vendors: ALL,
    default_aggregation: 'sum', sources: ['scheduler', 'billing'],
    scope: ['job', 'user', 'tenant'],
    def: '已分配或已使用的加速卡数 × 时间。',
    calc: 'sum(已分配卡数/区间 × 区间秒数) / 3600。',
    sig: '算力成本与计费（chargeback）的基本单位。',
    related: ['cost.idle_card_hours', 'cost.goodput.pct', 'cost.per_million_tokens'],
    confused: [
      { name: '空闲卡时', diff: '卡时是总消耗；空闲卡时是其中被浪费的子集。' },
      { name: 'Goodput', diff: '卡时是成本指标；Goodput 衡量有效训练时间占比。' }
    ],
    notes: '跟踪已分配卡时 vs 活跃卡时以暴露浪费。'
  },
  {
    metric_id: 'cost.per_million_tokens', display_name: '每百万 Token 成本', en: 'Cost per Million Tokens', unit: '$/Mtok',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['billing', 'training_hook'],
    def: '训练一百万 token 的算力成本。',
    calc: '(卡时 × 卡时单价) / (已处理 token 数 / 1e6)。',
    sig: '领导层关注的单位经济（unit-economics）指标。',
    related: ['cost.card_hours', 'training.throughput.tokens', 'cost.goodput.pct'],
    confused: [{ name: '卡时', diff: '每百万 token 成本按产出归一化开支；卡时是原始消耗。' }],
    notes: '> 基线 × 1.3（或 Goodput < 70%）标记为成本异常。'
  },
  {
    metric_id: 'cost.goodput.pct', display_name: 'Goodput 有效产出率', en: 'Goodput', unit: '%',
    level: 'L1', priority: 'P1', layer: 'cost', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'avg', sources: ['training_hook', 'scheduler'],
    def: '有效（被 checkpoint 保存下来的）训练时间占墙钟已分配时间的比例（源自 Google ML Goodput）。',
    calc: '有效训练秒数 / 墙钟已分配秒数 × 100；上次 checkpoint 之后、故障/抢占之前的工作不计为有效。',
    sig: '衡量真实生产力——可分解为调度 Goodput、运行时 Goodput 与程序 Goodput（≈MFU）；大规模训练中 1% 的提升即可节省数百万美元。',
    related: ['cost.card_hours', 'accelerator.idle.pct', 'cost.per_million_tokens'],
    confused: [{ name: '卡时', diff: 'Goodput 是效率比率；卡时是绝对消耗。' }],
    notes: '目标 ≥ 80%（领先的 TPU 集群可达 97%+）；偏低意味着大量已分配时间被中断、重启、停顿或开销吞噬。'
  },
  {
    metric_id: 'cost.budget.burn', display_name: '预算消耗率', en: 'Budget Burn', unit: '%',
    level: 'L1', priority: 'P2', layer: 'cost', type: 'gauge', vendors: ALL,
    default_aggregation: 'sum', sources: ['billing'],
    def: '某周期内已消耗的预算占比。',
    calc: '至今开支 / 预算 × 100。',
    sig: '让租户/项目保持在财务额度内。',
    related: ['cost.card_hours', 'cost.per_million_tokens'],
    confused: [],
    notes: 'budget_used.pct > 阈值触发超预算告警（P2）。'
  },
  {
    metric_id: 'sched.queue.depth', display_name: '队列深度', en: 'Queue Depth', unit: 'jobs',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: '在调度队列中等待的作业/Pod 数量。',
    calc: '各队列 count(待处理作业)。',
    sig: '用于容量与公平性决策的积压指标。',
    related: ['sched.queue.time', 'sched.fragmentation.pct', 'k8s.pod.pending.seconds'],
    confused: [{ name: '排队时长', diff: '深度是有多少在等；时长是等多久。' }],
    notes: '队列持续有深度却仍有空闲卡，指向碎片化/配额限制。'
  },
  {
    metric_id: 'sched.queue.time', display_name: '排队时长', en: 'Queue Time', unit: 'min',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['scheduler'],
    def: '作业在启动前的排队等待时间。',
    calc: '(开始时间 − 提交时间) 的 p50/p95。',
    sig: '平台响应性 / SLO 达成的直接度量。',
    related: ['sched.queue.depth', 'k8s.pod.pending.seconds'],
    confused: [{ name: 'Pod 等待调度时长', diff: '排队时长是调度器/配额层面；Pending 时长是 K8s 放置层面。' }],
    notes: 'P95 > 30 分钟即突破示例排队 SLO。'
  },
  {
    metric_id: 'sched.fragmentation.pct', display_name: '资源碎片率', en: 'Resource Fragmentation Ratio', unit: '%',
    level: 'L1', priority: 'P1', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: '因型号/拓扑/配额约束而无法被调度的剩余资源占比。',
    calc: '不可调度的空闲卡 / 总空闲卡 × 100。',
    sig: '解释"明明有卡，作业却仍在排队"。',
    related: ['sched.queue.depth', 'k8s.schedule.failures', 'fleet.cards.allocated'],
    confused: [{ name: '空闲卡数', diff: '有空闲卡不代表能调度大作业；碎片率刻画的是不可用容量。' }],
    notes: '按区域/型号/拓扑分解以定向消除碎片。'
  },
  {
    metric_id: 'sched.preemption.events', display_name: '抢占次数', en: 'Preemption', unit: 'events',
    level: 'L1', priority: 'P2', layer: 'scheduling', type: 'increase', vendors: ALL,
    default_aggregation: 'increase', sources: ['scheduler'],
    def: '为给更高优先级任务腾资源而被抢占的作业/Pod。',
    calc: 'increase(抢占计数器) 在窗口内的增量。',
    sig: '高抢占会损害 Goodput 与公平性。',
    related: ['cost.goodput.pct', 'k8s.pod.restarts'],
    confused: [],
    notes: '同一租户频繁被抢占，意味着配额/优先级配置有误。'
  },
  {
    metric_id: 'sched.quota.utilization', display_name: '配额使用率', en: 'Quota Utilization', unit: '%',
    level: 'L1', priority: 'P2', layer: 'scheduling', type: 'gauge', vendors: ALL,
    default_aggregation: 'avg', sources: ['scheduler'],
    def: '租户/队列配额当前使用的比例。',
    calc: '已用配额 / 分配配额 × 100。',
    sig: '跨租户的公平性与容量规划输入。',
    related: ['fleet.cards.allocated', 'sched.queue.time'],
    confused: [],
    notes: '配额打满且队列很深，则有理由扩大该租户配额。'
  },

  // ── L2 · 专家诊断指标 (§7.4) ─────────────────────────────────────────────────
  {
    metric_id: 'expert.sm.occupancy.pct', display_name: 'SM/Warp 占用率', en: 'SM / Warp Occupancy', unit: '%',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ['nvidia'],
    default_aggregation: 'avg', sources: ['profiler', 'dcgm_exporter'],
    def: '每个 SM 上活跃 warp 数相对架构最大值的比例（对应 DCGM_FI_PROF_SM_OCCUPANCY）。',
    calc: '活跃 warp / 每 SM 最大 warp × 100。',
    sig: '用于性能调优时定位 CUDA 内核低效。',
    related: ['accelerator.utilization.compute.pct', 'training.mfu.pct', 'expert.operator.latency_top'],
    confused: [{ name: '计算利用率', diff: '占用率是内核调度器指标；利用率是粗粒度的繁忙/空闲。' }],
    notes: '默认不全局采集——仅对选定作业开启。'
  },
  {
    metric_id: 'expert.cache.miss', display_name: '缓存/TLB 未命中 / IPC', en: 'Cache / TLB Miss / IPC', unit: 'ratio',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ['nvidia', 'generic'],
    default_aggregation: 'avg', sources: ['profiler', 'ebpf'],
    def: 'L1/L2/L3 缓存未命中率、TLB 未命中与每周期指令数（IPC）。',
    calc: '未命中事件 / 访问事件；IPC = 指令数 / 周期数。',
    sig: '定位 CPU/内存子系统瓶颈。',
    related: ['expert.ebpf.syscall', 'system.cpu.utilization.pct'],
    confused: [],
    notes: '在采集窗口内采样；不存入核心 TSDB。'
  },
  {
    metric_id: 'expert.operator.latency_top', display_name: '算子耗时 Top20 / 显存 Top20', en: 'Operator Latency Top20 / Memory Top20', unit: 'ms / MB',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'topn', vendors: NV_PPU,
    default_aggregation: 'topn', sources: ['profiler'],
    def: '最慢的 20 个算子与显存占用最大的 20 个算子。',
    calc: '从 profiler trace 中 rank_top_n(算子时长) 与 rank_top_n(算子显存)。',
    sig: '把模型级优化引向真正重要的算子。',
    related: ['expert.sm.occupancy.pct', 'training.step.breakdown'],
    confused: [],
    notes: 'PyTorch Profiler 按计划采样；算子名存于 profile 存储，不入核心 TSDB。'
  },
  {
    metric_id: 'expert.nccl.debug', display_name: 'NCCL 调试/算法/通道', en: 'NCCL Debug / Algorithm / Channels', unit: 'info',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'state', vendors: ['nvidia'],
    default_aggregation: 'last', sources: ['nccl'],
    def: 'NCCL 算法选择（Ring/Tree）、channel/ring 信息与调试输出。',
    calc: '针对某次集合操作从 NCCL 调试日志解析。',
    sig: '解释集合带宽效率为何偏低。',
    related: ['comm.bandwidth.efficiency.pct', 'comm.allreduce.duration.ms'],
    confused: [],
    notes: '仅对异常作业开启以避免日志泛滥。'
  },
  {
    metric_id: 'expert.ebpf.syscall', display_name: 'eBPF 系统调用/TCP 重传/块 IO 延迟', en: 'eBPF Syscall / TCP Retrans / Block-IO Latency', unit: 'mixed',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: ALL,
    default_aggregation: 'p95', sources: ['ebpf'],
    def: '通过 eBPF 捕获的系统级 syscall 延迟、TCP 重传与块 IO 延迟。',
    calc: 'eBPF 探针短窗口采样；各探针的百分位。',
    sig: '定位高层指标看不到的系统级瓶颈。',
    related: ['expert.cache.miss', 'network.bit.errors', 'system.cpu.iowait.pct'],
    confused: [],
    notes: '事件触发或短窗口采样以限制开销。'
  },
  {
    metric_id: 'expert.memory.fragmentation', display_name: '显存碎片化/分配器详情', en: 'Memory Fragmentation / Allocator Details', unit: '%',
    level: 'L2', priority: 'P2', layer: 'expert', type: 'gauge', vendors: NV_PPU,
    default_aggregation: 'max', sources: ['framework_hook'],
    def: '设备显存碎片化与分配器（allocator）内存池统计。',
    calc: '碎片化空闲字节 / 总空闲字节 × 100，外加分配器内存池统计。',
    sig: '即使利用率看起来正常，也能诊断 OOM 与内存泄漏。',
    related: ['accelerator.memory.used.pct', 'system.oom.kill.events'],
    confused: [{ name: '显存利用率', diff: '碎片化可能在远未达 100% 容量时就触发 OOM。' }],
    notes: '需要框架 hook 支持；按需采样。'
  }
]

export const METRIC_BY_ID = Object.fromEntries(METRIC_DICTIONARY.map((m) => [m.metric_id, m]))

// Grouping helpers for the Settings dictionary view.
export const LEVELS = ['L0', 'L1', 'L2']
export const LEVEL_META = {
  L0: { label: 'L0 · 首页核心', desc: '用于快速全局判断（Overview 首屏），不超过 12 项。' },
  L1: { label: 'L1 · 标准分析', desc: '日常排障与容量运营（资源 / 作业 / 趋势）。' },
  L2: { label: 'L2 · 专家诊断', desc: '深度性能与芯片适配，按需开启。' }
}
export const LAYER_LABEL = {
  hardware: '硬件', system: '系统', k8s: 'Kubernetes', network: '网络',
  storage: '存储', comm: '集合通信', training: '训练', cost: '成本', scheduling: '调度', expert: '专家'
}

export function metricsByLevel(level) {
  return METRIC_DICTIONARY.filter((m) => m.level === level)
}
