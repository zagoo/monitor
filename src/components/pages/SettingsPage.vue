<script setup>
import { ref } from 'vue'
import { SlidersHorizontal, Database, Plug, BookOpen } from 'lucide-vue-next'
import { METRIC_DICTIONARY, ACCELERATOR_TYPES } from '../../data/catalog.js'
import MetricTooltip from '../common/MetricTooltip.vue'

const tab = ref('dictionary')
const TABS = [
  { id: 'dictionary', label: 'Metric Dictionary', icon: BookOpen },
  { id: 'profiles', label: 'Collection Profiles', icon: Database },
  { id: 'adapters', label: 'Adapters', icon: Plug }
]
const enabled = ref(Object.fromEntries(METRIC_DICTIONARY.map((m) => [m.metric_id, true])))

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
const layerTint = {
  hardware: 'bg-tint-sky text-link', training: 'bg-tint-lavender text-primary-deep',
  system: 'bg-tint-mint text-success', cost: 'bg-tint-peach text-warning'
}
const prioTint = { P0: 'bg-[#fde0e0] text-danger', P1: 'bg-tint-peach text-warning', P2: 'bg-tint-sky text-link' }
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

    <!-- metric dictionary -->
    <section v-if="tab === 'dictionary'" class="nz-card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-hairline text-[11px] uppercase tracking-wide text-stone">
            <th class="text-left px-4 py-3">Metric</th>
            <th class="text-left px-4 py-3">Layer</th>
            <th class="text-left px-4 py-3">Priority</th>
            <th class="text-left px-4 py-3">Unit</th>
            <th class="text-left px-4 py-3 hidden lg:table-cell">Source</th>
            <th class="text-right px-4 py-3">Enabled</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mm in METRIC_DICTIONARY" :key="mm.metric_id" class="border-b border-hairline-soft hover:bg-surface-soft transition-colors">
            <td class="px-4 py-3">
              <div class="text-[14px] font-medium text-charcoal"><MetricTooltip :metric-id="mm.metric_id" /></div>
              <div class="text-[11.5px] font-mono text-stone">{{ mm.metric_id }}</div>
            </td>
            <td class="px-4 py-3"><span class="nz-chip border-transparent capitalize" :class="layerTint[mm.layer]">{{ mm.layer }}</span></td>
            <td class="px-4 py-3"><span class="nz-chip border-transparent" :class="prioTint[mm.priority]">{{ mm.priority }}</span></td>
            <td class="px-4 py-3 text-[13px] font-mono text-slate">{{ mm.unit }}</td>
            <td class="px-4 py-3 hidden lg:table-cell text-[12px] text-steel">{{ mm.default_aggregation }}</td>
            <td class="px-4 py-3 text-right">
              <button class="h-5 w-9 rounded-full relative transition-colors inline-block" :class="enabled[mm.metric_id] ? 'bg-primary' : 'bg-hairline-strong'" @click="enabled[mm.metric_id] = !enabled[mm.metric_id]">
                <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" :class="enabled[mm.metric_id] ? 'left-[18px]' : 'left-0.5'" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- collection profiles -->
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

    <!-- adapters -->
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
