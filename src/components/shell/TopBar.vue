<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Search, RefreshCw, Download, ChevronDown, Cpu, Radio } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'

const m = useMonitor()
const { state, TIME_RANGES } = m
const rangeOpen = ref(false)
const now = ref(Date.now())
let t
function onDocClick(e) {
  if (rangeOpen.value && !e.target.closest('.range-dd')) rangeOpen.value = false
}
function onKey(e) { if (e.key === 'Escape') rangeOpen.value = false }
onMounted(() => {
  t = setInterval(() => (now.value = Date.now()), 1000)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  clearInterval(t)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})

const currentRange = computed(() => TIME_RANGES.find((r) => r.id === state.timeRange))
const ago = computed(() => {
  const s = Math.round((now.value - state.lastRefresh) / 1000)
  if (s < 2) return '刚刚'
  if (s < 60) return `${s} 秒前`
  return `${Math.floor(s / 60)} 分钟前`
})
function selectRange(id) { m.setTimeRange(id); rangeOpen.value = false }
</script>

<template>
  <header class="h-16 shrink-0 bg-canvas border-b border-hairline flex items-center px-8 gap-4">
    <!-- brand -->
    <div class="flex items-center gap-2.5 pr-2">
      <div class="h-8 w-8 rounded-md bg-navy grid place-items-center">
        <Cpu :size="18" class="text-cyber-cyan" />
      </div>
      <div class="leading-tight">
        <div class="text-[15px] font-semibold text-charcoal">算力监控</div>
        <div class="text-[11px] text-stone -mt-0.5">大模型训练平台</div>
      </div>
      <span class="ml-1 nz-chip bg-tint-lavender text-primary-deep border-transparent">生产</span>
    </div>

    <!-- global search -->
    <div class="flex-1 max-w-[420px] mx-auto">
      <div class="relative">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
        <input
          class="w-full h-11 rounded-md bg-surface border border-hairline pl-9 pr-3 text-[14px] text-ink placeholder:text-stone outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
          placeholder="搜索作业、节点、加速卡、告警…"
        />
      </div>
    </div>

    <!-- live indicator -->
    <button
      class="flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium border transition-colors"
      :class="state.live ? 'border-hairline text-charcoal bg-surface-soft' : 'border-hairline text-steel'"
      @click="m.toggleLive()"
    >
      <Radio :size="14" :class="state.live ? 'text-success' : 'text-stone'" />
      {{ state.live ? '实时' : '已暂停' }}
    </button>

    <!-- time range -->
    <div class="relative range-dd">
      <button class="nz-btn-secondary h-9 py-0" @click="rangeOpen = !rangeOpen">
        {{ currentRange.label }}<ChevronDown :size="15" />
      </button>
      <div v-if="rangeOpen" class="absolute right-0 mt-1.5 w-40 rounded-md border border-hairline bg-canvas shadow-nz-2 py-1 z-50">
        <button
          v-for="r in TIME_RANGES" :key="r.id"
          class="w-full text-left px-3 py-1.5 text-[14px] hover:bg-surface transition-colors"
          :class="r.id === state.timeRange ? 'text-primary font-medium' : 'text-ink'"
          @click="selectRange(r.id)"
        >{{ r.label }}</button>
      </div>
    </div>

    <!-- refresh -->
    <button class="h-9 w-9 grid place-items-center rounded-md border border-hairline text-charcoal hover:bg-surface transition-colors" @click="m.refresh()">
      <RefreshCw :size="15" :class="state.refreshing ? 'animate-spin' : ''" />
    </button>
    <button class="nz-btn-secondary h-9 py-0"><Download :size="15" />导出</button>

    <div class="flex items-center gap-2 pl-1">
      <span class="text-[12px] text-stone tnum">更新于 {{ ago }}</span>
      <div class="h-8 w-8 rounded-full bg-primary/15 text-primary grid place-items-center text-[13px] font-semibold">RS</div>
    </div>
  </header>
</template>
