<script setup>
import { computed } from 'vue'
import { HeartPulse, Cpu, Gauge, BellRing, Activity, Layers, Boxes, Zap, Server, ArrowUpRight, ArrowDownRight } from 'lucide-vue-next'
import Sparkline from './Sparkline.vue'
import MetricTooltip from './MetricTooltip.vue'

const ICONS = { HeartPulse, Cpu, Gauge, BellRing, Activity, Layers, Boxes, Zap, Server }

// Dark industrial-cyber KPI tile (PRD §12.3.4) used on the Overview hero row.
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  delta: { type: Number, default: null },
  deltaGood: { type: String, default: 'up' }, // which direction is good
  spark: { type: Array, default: () => [] },
  accent: { type: String, default: '#38e1ff' },
  icon: { type: String, default: 'Activity' },
  sub: { type: String, default: '' },
  metricId: { type: String, default: '' }
})

const IconComp = computed(() => ICONS[props.icon] || Activity)
const deltaColor = computed(() => {
  if (props.delta == null) return ''
  const positive = props.delta >= 0
  const good = props.deltaGood === 'up' ? positive : !positive
  return good ? 'text-cyber-green' : 'text-cyber-red'
})
const DeltaIcon = computed(() => (props.delta >= 0 ? ArrowUpRight : ArrowDownRight))
</script>

<template>
  <div class="cy-panel relative overflow-hidden p-5 h-[132px] flex flex-col justify-between group">
    <!-- accent edge -->
    <span class="absolute left-0 top-0 h-full w-[3px]" :style="{ background: accent, boxShadow: `0 0 14px ${accent}` }" />
    <div class="flex items-start justify-between">
      <span class="flex items-center gap-1">
        <span class="micro-label text-cyber-text-3">{{ label }}</span>
        <MetricTooltip v-if="metricId" :metric-id="metricId" icon-only dark />
      </span>
      <component :is="IconComp" :size="16" class="text-cyber-text-3" :style="{ color: accent }" />
    </div>
    <div class="flex items-end gap-1.5">
      <span class="cy-readout text-[30px] font-semibold leading-none text-cyber-text">{{ value }}</span>
      <span v-if="unit" class="cy-readout text-[14px] text-cyber-text-2 mb-0.5">{{ unit }}</span>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span v-if="delta != null" class="flex items-center gap-0.5 text-[12px] font-medium cy-readout" :class="deltaColor">
          <component :is="DeltaIcon" :size="13" />{{ Math.abs(delta) }}{{ unit === '%' ? 'pp' : '%' }}
        </span>
        <span v-if="sub" class="text-[12px] text-cyber-text-3">{{ sub }}</span>
      </div>
      <Sparkline v-if="spark.length" :data="spark" :color="accent" :width="80" :height="26" />
    </div>
  </div>
</template>
