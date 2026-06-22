<script setup>
import { computed, ref } from 'vue'

// Multi-series SVG line chart with a cyber grid, hover crosshair and legend.
const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ name, color, data:[] }]
  height: { type: Number, default: 220 },
  unit: { type: String, default: '' },
  yMax: { type: Number, default: null },
  yMin: { type: Number, default: 0 },
  area: { type: Boolean, default: true },
  xLabels: { type: Array, default: () => [] }
})

const W = 760
const H = computed(() => props.height)
const padL = 38
const padR = 14
const padT = 14
const padB = 22
const hover = ref(null)

const bounds = computed(() => {
  const all = props.series.flatMap((s) => s.data)
  const max = props.yMax ?? Math.max(1, ...all) * 1.1
  const min = props.yMin ?? Math.min(...all)
  return { max, min }
})

const plot = computed(() => {
  const { max, min } = bounds.value
  const span = max - min || 1
  const innerW = W - padL - padR
  const innerH = H.value - padT - padB
  const n = Math.max(...props.series.map((s) => s.data.length), 1)
  const x = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v) => padT + innerH - ((v - min) / span) * innerH
  return props.series.map((s) => {
    const pts = s.data.map((v, i) => [x(i), y(v)])
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    const areaPath = `${line} L${x(s.data.length - 1)},${padT + innerH} L${padL},${padT + innerH} Z`
    return { ...s, pts, line, areaPath }
  })
})

const yTicks = computed(() => {
  const { max, min } = bounds.value
  const t = []
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) * i) / 4
    const innerH = H.value - padT - padB
    const y = padT + innerH - (i / 4) * innerH
    t.push({ v: Math.round(v), y })
  }
  return t
})

function onMove(e) {
  const svg = e.currentTarget
  const rect = svg.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  const innerW = W - padL - padR
  const n = Math.max(...props.series.map((s) => s.data.length), 1)
  const idx = Math.round(clamp((px - padL) / innerW, 0, 1) * (n - 1))
  hover.value = idx
}
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)) }
const hoverX = computed(() => {
  if (hover.value == null || !plot.value[0]) return null
  const p = plot.value[0].pts[hover.value]
  return p ? p[0] : null
})
</script>

<template>
  <div class="w-full">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      :style="{ height: H + 'px' }"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <!-- grid -->
      <g>
        <line
          v-for="t in yTicks" :key="'g' + t.y"
          :x1="padL" :x2="W - padR" :y1="t.y" :y2="t.y"
          stroke="#232b39" stroke-width="1"
        />
        <text
          v-for="t in yTicks" :key="'l' + t.y"
          :x="padL - 8" :y="t.y + 3" text-anchor="end"
          class="cy-readout" font-size="10" fill="#5e6b7e"
        >{{ t.v }}</text>
      </g>

      <!-- areas + lines -->
      <g v-for="(s, si) in plot" :key="s.name">
        <defs>
          <linearGradient :id="'lg' + si" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="s.color" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="s.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path v-if="area" :d="s.areaPath" :fill="'url(#lg' + si + ')'" />
        <path :d="s.line" fill="none" :stroke="s.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- crosshair -->
      <g v-if="hoverX != null">
        <line :x1="hoverX" :x2="hoverX" :y1="padT" :y2="H - padB" stroke="#38e1ff" stroke-width="1" stroke-dasharray="3 3" opacity="0.7" />
        <g v-for="s in plot" :key="'h' + s.name">
          <circle v-if="s.pts[hover]" :cx="s.pts[hover][0]" :cy="s.pts[hover][1]" r="3.2" :fill="s.color" stroke="#0b0f17" stroke-width="1.5" />
        </g>
      </g>
    </svg>

    <!-- legend + hover readout -->
    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full" :style="{ background: s.color }" />
        <span class="text-[12px] text-cyber-text-2">{{ s.name }}</span>
        <span v-if="hover != null && s.data[hover] != null" class="cy-readout text-[12px] text-cyber-text">
          {{ s.data[hover] }}{{ unit }}
        </span>
      </div>
    </div>
  </div>
</template>
