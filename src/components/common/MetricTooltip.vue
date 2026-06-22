<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { Info } from 'lucide-vue-next'
import { METRIC_BY_ID } from '../../data/catalog.js'

const props = defineProps({
  metricId: { type: String, required: true },
  label: { type: String, default: '' },
  dark: { type: Boolean, default: false }
})
const m = METRIC_BY_ID[props.metricId]

const open = ref(false)
const anchor = ref(null)        // trigger element
const pos = ref({ top: 0, left: 0, placement: 'top' })
const CARD_W = 288              // matches w-72
const CARD_H_EST = 188         // estimated height for flip decision
const GAP = 8

function place() {
  const el = anchor.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  // flip below when there isn't room above
  const placement = r.top < CARD_H_EST + GAP && vh - r.bottom > r.top ? 'bottom' : 'top'
  let left = r.left
  left = Math.max(GAP, Math.min(left, vw - CARD_W - GAP)) // clamp to viewport
  const top = placement === 'top' ? r.top - GAP : r.bottom + GAP
  pos.value = { top, left, placement }
}

async function show() {
  open.value = true
  await nextTick()
  place()
}
function hide() { open.value = false }

function onScroll() { if (open.value) place() }
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
}
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <span
    ref="anchor"
    class="inline-flex items-center gap-1 align-middle"
    @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide"
  >
    <span :class="dark ? 'text-cyber-text-2' : 'text-steel'">{{ label || m?.display_name }}</span>
    <Info :size="13" :class="dark ? 'text-cyber-text-3' : 'text-stone'" class="cursor-help" tabindex="0" />
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150" enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-100" leave-to-class="opacity-0"
    >
      <div
        v-if="open && m"
        class="fixed z-[80] w-72 rounded-lg border border-hairline bg-canvas p-3.5 shadow-nz-4 text-left pointer-events-none"
        :style="{
          left: pos.left + 'px',
          top: pos.top + 'px',
          transform: pos.placement === 'top' ? 'translateY(-100%)' : 'none'
        }"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[14px] font-semibold text-charcoal">{{ m.display_name }}</span>
          <span class="nz-chip bg-tint-lavender text-primary-deep border-transparent text-[11px] shrink-0">{{ m.priority }} · {{ m.unit }}</span>
        </div>
        <p class="mt-2 text-[12.5px] leading-snug text-slate">{{ m.tooltip.definition }}</p>
        <p class="mt-2 text-[12px] leading-snug text-steel"><span class="font-semibold text-charcoal">Difference: </span>{{ m.tooltip.difference }}</p>
        <p class="mt-1.5 text-[12px] leading-snug text-steel"><span class="font-semibold text-charcoal">Caveat: </span>{{ m.tooltip.caveat }}</p>
        <div class="mt-2.5 flex items-center gap-1 border-t border-hairline-soft pt-2">
          <span class="micro-label text-stone">Default agg</span>
          <span class="text-[12px] font-mono text-slate">{{ m.default_aggregation }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
