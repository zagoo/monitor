<script setup>
const props = defineProps({
  status: { type: String, default: 'healthy' }, // healthy|warning|critical|offline
  dark: { type: Boolean, default: false }
})

const MAP = {
  healthy: { label: 'Healthy', light: 'bg-tint-mint text-success border-transparent', dark: 'text-cyber-green' },
  warning: { label: 'Warning', light: 'bg-tint-peach text-warning border-transparent', dark: 'text-cyber-amber' },
  critical: { label: 'Critical', light: 'bg-[#fde0e0] text-danger border-transparent', dark: 'text-cyber-red' },
  offline: { label: 'Offline', light: 'bg-tint-gray text-steel border-transparent', dark: 'text-cyber-text-3' }
}
const dotColor = { healthy: '#1aae39', warning: '#dd5b00', critical: '#e03131', offline: '#a4a097' }
</script>

<template>
  <span
    v-if="!dark"
    class="nz-chip"
    :class="MAP[status]?.light"
  >
    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: dotColor[status] }" />
    {{ MAP[status]?.label }}
  </span>
  <span v-else class="inline-flex items-center gap-1.5 text-[12px] font-medium" :class="MAP[status]?.dark">
    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: dotColor[status], boxShadow: status !== 'offline' ? `0 0 7px ${dotColor[status]}` : 'none' }" />
    {{ MAP[status]?.label }}
  </span>
</template>
