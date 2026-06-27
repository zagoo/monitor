<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

// Shared custom listbox — the ONLY dropdown primitive (DESIGN.md §"Dropdowns / Select
// controls", CLAUDE.md Rule 13 §9). Never use a native <select>: native <option> popups
// can't be styled and clip inside overflow:auto panels. The popup is teleported to <body>
// and positioned against the trigger's bounding rect so it aligns with the field.
// Single mode (v-model string) → one selected row with a trailing check; the trigger shows
// the chosen value. Multiple mode (v-model string[]) → a checkbox per row and a count badge
// on the trigger, so multi-selection stays obvious.
const props = defineProps({
  modelValue: { type: [String, Array], default: '' },
  options: { type: Array, required: true }, // { value, label, disabled?, meta? }
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  multiple: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const activeIndex = ref(-1)
const triggerRef = ref(null)
const listRef = ref(null)
const pos = ref({ left: 0, top: 0, minWidth: 0, maxHeight: 280, placement: 'below' })

const selectedValues = computed(() =>
  props.multiple
    ? (Array.isArray(props.modelValue) ? props.modelValue : [])
    : (props.modelValue == null || props.modelValue === '' ? [] : [props.modelValue])
)
const count = computed(() => selectedValues.value.length)
const hasValue = computed(() => count.value > 0)
const isSelected = (opt) => selectedValues.value.includes(opt.value)
// single-mode trigger text: the chosen label, else the placeholder
const triggerText = computed(() => {
  if (!hasValue.value) return props.placeholder
  return props.options.find((o) => o.value === selectedValues.value[0])?.label || props.placeholder
})

// ── Popup geometry: place 4px below the trigger, flip above when space is tight, clamp
// height to a scrollable band. Width fits the content (max-content, never narrower than the
// trigger, capped) so a compact trigger still shows full option labels. ──
const GAP = 4
function place() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const popW = listRef.value?.offsetWidth || r.width
  const spaceBelow = window.innerHeight - r.bottom - GAP
  const spaceAbove = r.top - GAP
  const placement = spaceBelow < 200 && spaceAbove > spaceBelow ? 'above' : 'below'
  const avail = placement === 'below' ? spaceBelow : spaceAbove
  const maxHeight = Math.max(140, Math.min(280, avail - 4))
  const top = placement === 'below' ? r.bottom + GAP : r.top - GAP
  const left = Math.max(8, Math.min(r.left, window.innerWidth - popW - 8))
  pos.value = { left, top, minWidth: r.width, maxHeight, placement }
}
function onScroll() { if (open.value) place() }
function onDocClick(e) {
  if (!open.value) return
  if (triggerRef.value?.contains(e.target) || listRef.value?.contains(e.target)) return
  close()
}
function bind() {
  document.addEventListener('click', onDocClick, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
}
function unbind() {
  document.removeEventListener('click', onDocClick, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
}

async function openMenu() {
  if (props.disabled) return
  open.value = true
  const sel = props.options.findIndex((o) => isSelected(o))
  activeIndex.value = sel >= 0 ? sel : props.options.findIndex((o) => !o.disabled)
  await nextTick()
  place()
  bind()
  scrollActiveIntoView()
}
function close() {
  if (!open.value) return
  open.value = false
  activeIndex.value = -1
  unbind()
}
function toggle() { open.value ? close() : openMenu() }

function pick(opt) {
  if (opt.disabled) return
  if (props.multiple) {
    const cur = selectedValues.value
    emit('update:modelValue', cur.includes(opt.value) ? cur.filter((v) => v !== opt.value) : [...cur, opt.value])
  } else {
    emit('update:modelValue', opt.value)
    close()
    triggerRef.value?.focus()
  }
}

function move(dir) {
  const n = props.options.length
  if (!n) return
  let i = activeIndex.value
  for (let step = 0; step < n; step++) {
    i = (i + dir + n) % n
    if (!props.options[i].disabled) { activeIndex.value = i; break }
  }
  scrollActiveIntoView()
}
async function scrollActiveIntoView() {
  await nextTick()
  if (!listRef.value || activeIndex.value < 0) return
  listRef.value.querySelectorAll('[role="option"]')[activeIndex.value]?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(e) {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); open.value ? move(1) : openMenu(); break
    case 'ArrowUp': e.preventDefault(); open.value ? move(-1) : openMenu(); break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!open.value) openMenu()
      else if (activeIndex.value >= 0) pick(props.options[activeIndex.value])
      break
    case 'Escape': if (open.value) { e.preventDefault(); close(); triggerRef.value?.focus() } break
    case 'Tab': if (open.value) close(); break
  }
}

onBeforeUnmount(unbind)
</script>

<template>
  <div class="relative">
    <!-- Trigger — compact field (32px, 14px text to match the page's ghost buttons). Open/focus
         thickens to a 2px primary border with horizontal padding trimmed 1px so text never shifts. -->
    <button
      ref="triggerRef"
      type="button"
      class="flex items-center gap-1.5 w-full h-8 rounded-md font-sans text-sm transition-colors"
      :class="[
        open ? 'px-[9px]' : 'px-2.5',
        disabled
          ? 'bg-surface border border-hairline-strong cursor-not-allowed'
          : open
            ? 'bg-canvas border-2 border-primary'
            : 'bg-canvas border border-hairline-strong hover:border-stone'
      ]"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onKeydown"
    >
      <template v-if="multiple">
        <span class="flex-1 min-w-0 truncate text-left" :class="disabled ? 'text-muted' : 'text-charcoal'">{{ placeholder }}</span>
        <span v-if="count" class="shrink-0 h-4 min-w-[16px] px-1 grid place-items-center rounded-full bg-primary text-white text-[10px] font-semibold leading-none">{{ count }}</span>
      </template>
      <span v-else class="flex-1 min-w-0 truncate text-left" :class="disabled ? 'text-muted' : hasValue ? 'text-ink' : 'text-steel'">{{ triggerText }}</span>
      <ChevronDown :size="14" class="shrink-0 text-steel transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-[120ms] ease-out" enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100 ease-out" leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          ref="listRef"
          role="listbox"
          :aria-multiselectable="multiple || undefined"
          class="fixed z-[1000] w-max max-w-[320px] rounded-md border border-hairline bg-canvas shadow-nz-4 p-1 flex flex-col gap-px overflow-y-auto scroll-thin"
          :style="{
            left: pos.left + 'px',
            top: pos.top + 'px',
            minWidth: pos.minWidth + 'px',
            maxHeight: pos.maxHeight + 'px',
            transform: pos.placement === 'above' ? 'translateY(-100%)' : 'none'
          }"
        >
          <button
            v-for="(opt, i) in options"
            :key="opt.value"
            type="button"
            role="option"
            :aria-selected="isSelected(opt)"
            :aria-disabled="opt.disabled || undefined"
            class="sm-opt"
            :class="{ active: activeIndex === i, selected: !multiple && isSelected(opt), disabled: opt.disabled }"
            :title="opt.label"
            @click="pick(opt)"
            @mousemove="!opt.disabled && (activeIndex = i)"
          >
            <span v-if="multiple" class="sm-box" :class="{ on: isSelected(opt) }"><Check v-if="isSelected(opt)" :size="11" /></span>
            <span class="flex-1 min-w-0 truncate">{{ opt.label }}</span>
            <span v-if="opt.meta" class="shrink-0 text-[10px] text-stone uppercase">{{ opt.meta }}</span>
            <Check v-if="!multiple && isSelected(opt)" :size="13" class="shrink-0" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Borderless, compact options (14px to match the page's ghost buttons). Hover/keyboard-active
   + selected colours are component-scoped translucent-blue literals (per DESIGN.md). */
.sm-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 14px;
  line-height: 1.35;
  color: #1a1a1a;
  transition: background-color 120ms ease, color 120ms ease;
}
.sm-opt:hover,
.sm-opt.active {
  background: rgba(0, 117, 222, 0.1);
  color: #005bab;
}
.sm-opt.selected {
  font-weight: 600;
  color: #0075de;
}
.sm-opt.selected:hover,
.sm-opt.selected.active {
  background: rgba(0, 117, 222, 0.14);
  color: #0075de;
}
.sm-opt.disabled {
  color: #bbb8b1;
  cursor: not-allowed;
}
.sm-opt.disabled:hover {
  background: transparent;
  color: #bbb8b1;
}
/* Multi-select checkbox — the restored multi-select affordance (matches the original filter box). */
.sm-box {
  height: 15px;
  width: 15px;
  border-radius: 4px;
  border: 1px solid #c8c4be;
  display: grid;
  place-items: center;
  color: #fff;
  flex-shrink: 0;
}
.sm-box.on {
  background: #5645d4;
  border-color: #5645d4;
}
</style>
