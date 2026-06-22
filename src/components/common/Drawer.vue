<script setup>
import { X } from 'lucide-vue-next'
defineProps({ title: String, subtitle: String })
const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60]">
      <div class="absolute inset-0 bg-ink-deep/30 animate-fade-in" @click="emit('close')" />
      <aside
        class="absolute right-0 top-0 h-full w-[560px] max-w-[92vw] bg-cyber-bg border-l border-cyber-line shadow-nz-4 animate-slide-in flex flex-col"
      >
        <header class="h-[72px] shrink-0 px-6 flex items-center justify-between border-b border-cyber-line bg-cyber-panel">
          <div class="min-w-0">
            <h2 class="text-[16px] font-semibold text-cyber-text truncate">{{ title }}</h2>
            <p v-if="subtitle" class="text-[12.5px] text-cyber-text-2 truncate">{{ subtitle }}</p>
          </div>
          <button
            class="h-8 w-8 grid place-items-center rounded-md text-cyber-text-2 hover:bg-cyber-panel-2 hover:text-cyber-text transition-colors"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </header>
        <div class="flex-1 overflow-y-auto scroll-thin on-dark p-6 space-y-5">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>
