<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 88 },
  height: { type: Number, default: 28 },
  color: { type: String, default: '#38e1ff' },
  fill: { type: Boolean, default: true },
  strokeWidth: { type: Number, default: 1.5 }
})

const geo = computed(() => {
  const d = props.data
  if (d.length < 2) return { line: '', area: '', last: null }
  const min = Math.min(...d)
  const max = Math.max(...d)
  const span = max - min || 1
  const stepX = props.width / (d.length - 1)
  const pad = 2
  const h = props.height - pad * 2
  const pts = d.map((v, i) => [i * stepX, pad + h - ((v - min) / span) * h])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${props.width},${props.height} L0,${props.height} Z`
  return { line, area, last: pts[pts.length - 1] }
})

const gid = `sg-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" class="overflow-visible">
    <defs>
      <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path v-if="fill && geo.area" :d="geo.area" :fill="`url(#${gid})`" />
    <path :d="geo.line" fill="none" :stroke="color" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" />
    <circle v-if="geo.last" :cx="geo.last[0]" :cy="geo.last[1]" r="1.8" :fill="color" />
  </svg>
</template>
