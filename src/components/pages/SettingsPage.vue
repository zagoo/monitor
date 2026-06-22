<script setup>
import { ref, computed } from 'vue'
import { Database, Plug, BookOpen, CheckCircle2 } from 'lucide-vue-next'
import { METRIC_DICTIONARY, LEVELS, LEVEL_META, LAYER_LABEL } from '../../data/catalog.js'
import MetricTooltip from '../common/MetricTooltip.vue'

const tab = ref('dictionary')
const TABS = [
  { id: 'dictionary', label: 'Metric Dictionary', icon: BookOpen },
  { id: 'profiles', label: 'Collection Profiles', icon: Database },
  { id: 'adapters', label: 'Adapters', icon: Plug }
]
const enabled = ref(Object.fromEntries(METRIC_DICTIONARY.map((m) => [m.metric_id, true])))

// group metrics: level -> layer -> [metrics]
const grouped = computed(() =>
  LEVELS.map((level) => {
    const metrics = METRIC_DICTIONARY.filter((m) => m.level === level)
    const byLayer = {}
    for (const m of metrics) (byLayer[m.layer] ||= []).push(m)
    return {
      level,
      meta: LEVEL_META[level],
      count: metrics.length,
      layers: Object.entries(byLayer).map(([layer, items]) => ({ layer, label: LAYER_LABEL[layer] || layer, items }))
    }
  })
)
const totals = computed(() => ({
  all: METRIC_DICTIONARY.length,
  L0: METRIC_DICTIONARY.filter((m) => m.level === 'L0').length,
  L1: METRIC_DICTIONARY.filter((m) => m.level === 'L1').length,
  L2: METRIC_DICTIONARY.filter((m) => m.level === 'L2').length
}))

const PROFILES = [
  { name: 'Basic', target: 'On-call & capacity', content: 'P0 core: health, utilization, memory, temperature, power, errors, K8s state', policy: 'Enabled globally', on: true },
  { name: 'Standard', target: 'Daily troubleshooting', content: 'P1: network, communication, step time, throughput, data loading, checkpoint, cost', policy: 'Default for training clusters', on: true },
  { name: 'Expert', target: 'Performance tuning', content: 'P2: profiler, operators, SM/Warp, eBPF, NCCL debug', policy: 'Per job / time window', on: false }
]
const ADAPTERS = [
  { vendor: 'NVIDIA', via: 'DCGM Exporter + NVML', models: 'H200 · RTX PRO 5000', status: 'healthy' },
  { vendor: 'Alibaba PPU', via: 'PPU SDK Exporter + PAI/ACS', models: 'Zhenwu 810E · M890', status: 'healthy' },
  { vendor: 'Kubernetes', via: 'kube-state-metrics + kubelet', models: 'all', status: 'healthy' },
  { vendor: 'Generic', via: 'OpenTelemetry adapter', models: 'custom GPU/NPU/ASIC', status: 'gray-release' }
]
const prioTint = {
  P0: 'bg-[#fde0e0] text-danger', P1: 'bg-tint-peach text-warning',
  P2: 'bg-tint-sky text-link', P3: 'bg-tint-gray text-steel'
}
const levelTint = { L0: 'bg-navy text-white', L1: 'bg-tint-lavender text-primary-deep', L2: 'bg-tint-mint text-success' }
</script>

<template>
  <div class="space-y-4">
    <header>
      <h2 class="text-[28px] font-semibold text-charcoal tracking-tight">Metrics & Configuration</h2>
      <p class="text-[14px] text-steel mt-0.5">Metric dictionary, collection profiles, thresholds and adapter health.</p>
    </header>

    <div class="flex items-center gap-2">
      <button v-for="t in TABS" :key="t.id" class="nz-pill" :class="tab === t.id ? 'nz-pill-active' : ''" @click="tab = t.id">
        <component :is="t.icon" :size="14" />{{ t.label }}
      </button>
    </div>

    <!-- ── METRIC DICTIONARY ── -->
    <template v-if="tab === 'dictionary'">
      <!-- coverage banner -->
      <div class="nz-card p-4 flex items-center gap-4 flex-wrap">
        <CheckCircle2 :size="20" class="text-success" />
        <span class="text-[14px] text-charcoal font-medium">{{ totals.all }} metrics documented — full PRD coverage (L0 / L1 / L2 + §8 confused-metrics).</span>
        <div class="ml-auto flex items-center gap-2">
          <span class="nz-chip border-transparent" :class="levelTint.L0">L0 · {{ totals.L0 }}</span>
          <span class="nz-chip border-transparent" :class="levelTint.L1">L1 · {{ totals.L1 }}</span>
          <span class="nz-chip border-transparent" :class="levelTint.L2">L2 · {{ totals.L2 }}</span>
        </div>
      </div>

      <section v-for="grp in grouped" :key="grp.level" class="nz-card overflow-hidden">
        <div class="px-5 py-3.5 bg-surface-soft border-b border-hairline flex items-center justify-between">
          <div>
            <h3 class="text-[15px] font-semibold text-charcoal flex items-center gap-2">
              <span class="nz-chip border-transparent" :class="levelTint[grp.level]">{{ grp.level }}</span>
              {{ grp.meta.label }}
            </h3>
            <p class="text-[12.5px] text-steel mt-0.5">{{ grp.meta.desc }}</p>
          </div>
          <span class="cy-readout text-[13px] text-steel">{{ grp.count }} metrics</span>
        </div>

        <div v-for="lyr in grp.layers" :key="lyr.layer" class="border-b border-hairline-soft last:border-0">
          <div class="px-5 pt-3 pb-1">
            <span class="micro-label text-stone">{{ lyr.label }}</span>
          </div>
          <table class="w-full">
            <tbody>
              <tr v-for="mm in lyr.items" :key="mm.metric_id" class="hover:bg-surface-soft transition-colors">
                <td class="pl-5 pr-3 py-2.5 w-1/2">
                  <div class="text-[14px] font-medium text-charcoal"><MetricTooltip :metric-id="mm.metric_id" /></div>
                  <div class="text-[11px] font-mono text-stone">{{ mm.metric_id }}</div>
                </td>
                <td class="px-3 py-2.5"><span class="nz-chip border-transparent" :class="prioTint[mm.priority]">{{ mm.priority }}</span></td>
                <td class="px-3 py-2.5 text-[13px] font-mono text-slate whitespace-nowrap">{{ mm.unit }}</td>
                <td class="px-3 py-2.5 hidden lg:table-cell text-[12px] text-steel font-mono">{{ mm.default_aggregation }}</td>
                <td class="px-5 py-2.5 text-right">
                  <button class="h-5 w-9 rounded-full relative transition-colors inline-block align-middle"
                    :class="enabled[mm.metric_id] ? 'bg-primary' : 'bg-hairline-strong'"
                    @click="enabled[mm.metric_id] = !enabled[mm.metric_id]">
                    <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" :class="enabled[mm.metric_id] ? 'left-[18px]' : 'left-0.5'" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ── COLLECTION PROFILES ── -->
    <section v-else-if="tab === 'profiles'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="p in PROFILES" :key="p.name" class="nz-card p-5">
        <div class="flex items-center justify-between">
          <h3 class="text-[16px] font-semibold text-charcoal">{{ p.name }}</h3>
          <span class="nz-chip border-transparent" :class="p.on ? 'bg-tint-mint text-success' : 'bg-tint-gray text-steel'">{{ p.on ? 'On' : 'Per job' }}</span>
        </div>
        <p class="text-[12.5px] text-steel mt-1">{{ p.target }}</p>
        <p class="text-[13px] text-slate mt-3 leading-snug">{{ p.content }}</p>
        <p class="text-[12px] text-stone mt-3 pt-3 border-t border-hairline-soft">{{ p.policy }}</p>
      </div>
    </section>

    <!-- ── ADAPTERS ── -->
    <section v-else class="nz-card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-hairline text-[11px] uppercase tracking-wide text-stone">
            <th class="text-left px-4 py-3">Vendor</th><th class="text-left px-4 py-3">Collected via</th>
            <th class="text-left px-4 py-3">Models</th><th class="text-right px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ad in ADAPTERS" :key="ad.vendor" class="border-b border-hairline-soft hover:bg-surface-soft transition-colors">
            <td class="px-4 py-3 text-[14px] font-medium text-charcoal">{{ ad.vendor }}</td>
            <td class="px-4 py-3 text-[13px] text-slate font-mono">{{ ad.via }}</td>
            <td class="px-4 py-3 text-[13px] text-steel">{{ ad.models }}</td>
            <td class="px-4 py-3 text-right">
              <span class="nz-chip border-transparent" :class="ad.status === 'healthy' ? 'bg-tint-mint text-success' : 'bg-tint-peach text-warning'">{{ ad.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
