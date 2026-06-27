<script setup>
import { computed } from 'vue'
import { RotateCcw, Filter, Sparkles } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'
import SelectMenu from '../common/SelectMenu.vue'

const m = useMonitor()
const { state, REGIONS, ACCELERATOR_TYPES, TENANTS } = m

const regionOptions = REGIONS.map((r) => ({ value: r.region_id, label: r.region_name, meta: r.cloud_provider }))
const modelOptions = ACCELERATOR_TYPES.map((t) => ({ value: t.model, label: t.label, meta: t.vendor === 'nvidia' ? 'NVIDIA' : 'PPU' }))
const tenantOptions = TENANTS.map((t) => ({ value: t.tenant_id, label: t.name }))

// Write filters through rawState (state is readonly) and bump the refresh stamp, matching toggleFilter.
function applyFilter(key, val) {
  m.rawState.filters[key] = val
  m.rawState.lastRefresh = Date.now()
}

const PRESETS = [
  { id: 'low_util', label: '已分配 · 低利用' },
  { id: 'hi_mem_lo_compute', label: '高显存 · 低计算' }
]

const summary = computed(() => {
  const f = state.filters
  const parts = []
  parts.push(REGIONS.find((r) => f.region_ids[0])?.region_name ? f.region_ids.map((id) => REGIONS.find((r) => r.region_id === id)?.region_name).join(' + ') : '全部区域')
  if (f.accelerator_models.length) parts.push(f.accelerator_models.map((mm) => ACCELERATOR_TYPES.find((t) => t.model === mm)?.label).join(' + '))
  else parts.push('全部加速卡型号')
  if (f.tenant_ids.length) parts.push(f.tenant_ids.map((id) => TENANTS.find((t) => t.tenant_id === id)?.name).join(' + '))
  const preset = PRESETS.find((p) => p.id === state.preset)
  const matched = m.filteredAccelerators.value.length
  return { text: parts.join(', '), preset: preset?.label, matched }
})
</script>

<template>
  <div class="rounded-lg bg-surface border border-hairline px-3 py-2 flex items-center gap-2 flex-wrap">
    <Filter :size="15" class="text-steel ml-1" />

    <!-- Region -->
    <div class="w-28">
      <SelectMenu multiple placeholder="区域" :options="regionOptions"
        :model-value="state.filters.region_ids" @update:model-value="(v) => applyFilter('region_ids', v)" />
    </div>

    <!-- Accelerator model -->
    <div class="w-32">
      <SelectMenu multiple placeholder="加速卡" :options="modelOptions"
        :model-value="state.filters.accelerator_models" @update:model-value="(v) => applyFilter('accelerator_models', v)" />
    </div>

    <!-- Tenant -->
    <div class="w-28">
      <SelectMenu multiple placeholder="租户" :options="tenantOptions"
        :model-value="state.filters.tenant_ids" @update:model-value="(v) => applyFilter('tenant_ids', v)" />
    </div>

    <div class="h-5 w-px bg-hairline mx-0.5" />

    <!-- Metric presets -->
    <Sparkles :size="14" class="text-stone" />
    <button
      v-for="p in PRESETS" :key="p.id"
      class="nz-pill h-7"
      :class="state.preset === p.id ? 'nz-pill-active' : ''"
      @click="m.setPreset(p.id)"
    >{{ p.label }}</button>

    <button class="nz-btn-ghost ml-auto text-steel" @click="m.resetFilters()"><RotateCcw :size="14" />重置</button>
  </div>

  <!-- natural-language summary (§9.4) -->
  <p class="mt-2 px-1 text-[12.5px] text-steel">
    匹配 <span class="font-medium text-charcoal">{{ summary.matched }} 张卡</span> ·
    {{ summary.text }}<template v-if="summary.preset"> · <span class="text-primary font-medium">{{ summary.preset }}</span></template>
  </p>
</template>
