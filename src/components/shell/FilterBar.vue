<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check, RotateCcw, Filter, Sparkles } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'

const m = useMonitor()
const { state, REGIONS, ACCELERATOR_TYPES, TENANTS } = m
const openKey = ref(null)

function toggle(key) { openKey.value = openKey.value === key ? null : key }

// Close any open dropdown when clicking anywhere outside a dropdown root.
function onDocClick(e) {
  if (openKey.value && !e.target.closest('.filter-dd')) openKey.value = null
}
function onKey(e) { if (e.key === 'Escape') openKey.value = null }
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

const PRESETS = [
  { id: 'low_util', label: '已分配 · 低利用' },
  { id: 'hi_mem_lo_compute', label: '高显存 · 低计算' },
  { id: 'thermal', label: '热降频' },
  { id: 'hw_risk', label: '硬件风险' }
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

const active = (key, val) => state.filters[key].includes(val)
</script>

<template>
  <div class="rounded-lg bg-surface border border-hairline px-3 py-2 flex items-center gap-2 flex-wrap">
    <Filter :size="15" class="text-steel ml-1" />

    <!-- Region -->
    <Dropdown label="区域" :count="state.filters.region_ids.length" :open="openKey === 'region'" @toggle="toggle('region')">
      <button v-for="r in REGIONS" :key="r.region_id" class="opt" @click="m.toggleFilter('region_ids', r.region_id)">
        <span class="box" :class="active('region_ids', r.region_id) ? 'on' : ''"><Check v-if="active('region_ids', r.region_id)" :size="12" /></span>
        {{ r.region_name }}<span class="ml-auto text-[11px] text-stone uppercase">{{ r.cloud_provider }}</span>
      </button>
    </Dropdown>

    <!-- Accelerator model -->
    <Dropdown label="加速卡" :count="state.filters.accelerator_models.length" :open="openKey === 'model'" @toggle="toggle('model')">
      <button v-for="t in ACCELERATOR_TYPES" :key="t.model" class="opt" @click="m.toggleFilter('accelerator_models', t.model)">
        <span class="box" :class="active('accelerator_models', t.model) ? 'on' : ''"><Check v-if="active('accelerator_models', t.model)" :size="12" /></span>
        {{ t.label }}<span class="ml-auto text-[11px] text-stone">{{ t.vendor === 'nvidia' ? 'NVIDIA' : 'PPU' }}</span>
      </button>
    </Dropdown>

    <!-- Tenant -->
    <Dropdown label="租户" :count="state.filters.tenant_ids.length" :open="openKey === 'tenant'" @toggle="toggle('tenant')">
      <button v-for="t in TENANTS" :key="t.tenant_id" class="opt" @click="m.toggleFilter('tenant_ids', t.tenant_id)">
        <span class="box" :class="active('tenant_ids', t.tenant_id) ? 'on' : ''"><Check v-if="active('tenant_ids', t.tenant_id)" :size="12" /></span>
        {{ t.name }}
      </button>
    </Dropdown>

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

<script>
import { h } from 'vue'
import { ChevronDown as CD } from 'lucide-vue-next'
const Dropdown = (props, { slots, emit }) =>
  h('div', { class: 'relative filter-dd' }, [
    h('button', {
      class: 'inline-flex items-center gap-1.5 h-10 px-3 rounded-md bg-canvas border border-hairline text-[13.5px] font-medium text-charcoal hover:border-hairline-strong transition-colors',
      onClick: () => emit('toggle')
    }, [
      props.label,
      props.count ? h('span', { class: 'h-4 min-w-4 px-1 grid place-items-center rounded-full bg-primary text-white text-[10px] font-semibold' }, props.count) : null,
      h(CD, { size: 14, class: 'text-stone' })
    ]),
    props.open
      ? h('div', { class: 'absolute left-0 mt-1.5 w-60 rounded-md border border-hairline bg-canvas shadow-nz-2 py-1.5 z-50 max-h-72 overflow-y-auto scroll-thin' }, slots.default ? slots.default() : [])
      : null
  ])
Dropdown.props = ['label', 'count', 'open']
Dropdown.emits = ['toggle']
export default { components: { Dropdown } }
</script>

<style scoped>
.opt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 6px 12px;
  font-size: 13.5px;
  color: #1a1a1a;
  text-align: left;
  transition: background-color 0.12s;
}
.opt:hover { background: #f6f5f4; }
.box {
  height: 15px; width: 15px; border-radius: 4px;
  border: 1px solid #c8c4be; display: grid; place-items: center;
  color: #fff; flex-shrink: 0;
}
.box.on { background: #5645d4; border-color: #5645d4; }
</style>
