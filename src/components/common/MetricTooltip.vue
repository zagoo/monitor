<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { Info } from 'lucide-vue-next'
import { METRIC_BY_ID } from '../../data/catalog.js'

// Question-mark metric tooltip. Renders the FULL metric documentation:
// definition, calculation logic, significance, related metrics, easily-confused
// metrics and important notes. Teleported to <body> with a top-most z-index and
// viewport-aware flip so it is never clipped or obscured by any layer.
const props = defineProps({
  metricId: { type: String, required: true },
  label: { type: String, default: '' },
  dark: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false } // show only the (?) icon, no label text
})
const m = METRIC_BY_ID[props.metricId]

const open = ref(false)
const anchor = ref(null)
const pos = ref({ top: 0, left: 0, placement: 'top' })
const CARD_W = 320
const CARD_H_EST = 320
const GAP = 8

function place() {
  const el = anchor.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const placement = r.top < CARD_H_EST + GAP && vh - r.bottom > r.top ? 'bottom' : 'top'
  let left = r.left + r.width / 2 - CARD_W / 2
  left = Math.max(GAP, Math.min(left, vw - CARD_W - GAP))
  const top = placement === 'top' ? r.top - GAP : r.bottom + GAP
  pos.value = { top, left, placement }
}
// Hover-intent: when the mouse leaves the icon we don't close immediately — we wait a
// grace period so the user can travel onto the card to read, scroll or select it. Entering
// the card cancels the pending close; the card only closes once the mouse leaves the card.
const HIDE_DELAY = 220
let hideTimer = null

function cancelHide() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
}
async function show() {
  cancelHide()
  open.value = true
  await nextTick()
  place()
}
function scheduleHide() {
  cancelHide()
  hideTimer = setTimeout(() => { open.value = false; hideTimer = null }, HIDE_DELAY)
}
function onScroll() { if (open.value) place() }

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
}
onBeforeUnmount(() => {
  cancelHide()
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})

const relatedNames = (ids) => (ids || []).map((id) => METRIC_BY_ID[id]?.display_name || id)
</script>

<template>
  <span
    ref="anchor"
    class="inline-flex items-center gap-1 align-middle"
    @mouseenter="show" @mouseleave="scheduleHide" @focusin="show" @focusout="scheduleHide"
  >
    <span v-if="!iconOnly" :class="dark ? 'text-cyber-text-2' : 'text-steel'">{{ label || m?.display_name }}</span>
    <Info :size="13" :class="dark ? 'text-cyber-text-3' : 'text-stone'" class="cursor-help shrink-0" tabindex="0" />
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150" enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-100" leave-to-class="opacity-0"
    >
      <div
        v-if="open && m"
        class="fixed z-[2147483647] w-80 rounded-lg border border-hairline bg-canvas shadow-nz-4 text-left overflow-hidden"
        :style="{
          left: pos.left + 'px',
          top: pos.top + 'px',
          transform: pos.placement === 'top' ? 'translateY(-100%)' : 'none'
        }"
        @mouseenter="cancelHide" @mouseleave="scheduleHide"
      >
        <!-- header -->
        <div class="px-4 pt-3.5 pb-2.5 bg-surface-soft border-b border-hairline-soft">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[14px] font-semibold text-charcoal">{{ m.display_name }}</span>
            <span class="flex items-center gap-1 shrink-0">
              <span class="nz-chip bg-tint-lavender text-primary-deep border-transparent text-[11px]">{{ m.level }} · {{ m.priority }}</span>
              <span class="nz-chip bg-tint-gray text-slate border-transparent text-[11px]">{{ m.unit }}</span>
            </span>
          </div>
          <div class="mt-1 font-mono text-[11px] text-stone">{{ m.metric_id }}</div>
        </div>

        <div class="px-4 py-3 space-y-2.5 max-h-[60vh] overflow-y-auto scroll-thin">
          <Block label="Definition">{{ m.def }}</Block>
          <Block label="Calculation">{{ m.calc }}</Block>
          <Block label="Significance">{{ m.sig }}</Block>

          <div v-if="m.confused && m.confused.length">
            <span class="micro-label text-stone">Easily Confused With</span>
            <ul class="mt-1 space-y-1">
              <li v-for="c in m.confused" :key="c.name" class="text-[12px] leading-snug text-steel">
                <span class="font-semibold text-charcoal">{{ c.name }}:</span> {{ c.diff }}
              </li>
            </ul>
          </div>

          <div v-if="m.related && m.related.length">
            <span class="micro-label text-stone">Related Metrics</span>
            <div class="mt-1 flex flex-wrap gap-1">
              <span v-for="n in relatedNames(m.related)" :key="n" class="nz-chip bg-surface text-slate border-hairline text-[11px]">{{ n }}</span>
            </div>
          </div>

          <Block v-if="m.notes" label="Notes" warn>{{ m.notes }}</Block>

          <div class="flex items-center gap-3 border-t border-hairline-soft pt-2 text-[11px]">
            <span class="text-stone">Agg <span class="font-mono text-slate">{{ m.default_aggregation }}</span></span>
            <span class="text-stone">Source <span class="font-mono text-slate">{{ (m.sources || []).join(', ') }}</span></span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { h } from 'vue'
// Small labelled paragraph block used inside the tooltip body.
const Block = (props, { slots }) =>
  h('div', {}, [
    h('span', { class: 'micro-label ' + (props.warn ? 'text-warning' : 'text-stone') }, props.label),
    h('p', { class: 'mt-0.5 text-[12.5px] leading-snug ' + (props.warn ? 'text-charcoal' : 'text-slate') }, slots.default ? slots.default() : [])
  ])
Block.props = ['label', 'warn']
export default { components: { Block } }
</script>
