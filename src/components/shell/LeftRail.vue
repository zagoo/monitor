<script setup>
import { Star, MapPin, LayoutTemplate, History, Plus } from 'lucide-vue-next'
import { useMonitor } from '../../store/useMonitor.js'

const m = useMonitor()
const { state, REGIONS } = m

const favorites = [
  { label: '机群健康 · 全部区域', tab: 'overview' },
  { label: '已分配低利用卡', tab: 'resources' },
  { label: '慢训练作业', tab: 'jobs' }
]
const recentJobs = ['qwen-pretrain-stage3', 'moe-256e-pretrain', 'llava-vlm-sft', 'reward-model-v4']

const dot = { online: '#1aae39', degraded: '#dd5b00', offline: '#e03131' }
function regionFilter(id) { m.resetFilters(); m.rawState.filters.region_ids = [id]; m.setTab('resources') }
</script>

<template>
  <aside class="w-[248px] shrink-0 bg-surface-soft border-r border-hairline overflow-y-auto scroll-thin py-4 px-3">
    <Section title="收藏" :icon="Star">
      <button
        v-for="f in favorites" :key="f.label"
        class="rail-item" @click="m.setTab(f.tab)"
      >
        <Star :size="13" class="text-stone shrink-0" />
        <span class="truncate">{{ f.label }}</span>
      </button>
    </Section>

    <Section title="区域" :icon="MapPin">
      <button
        v-for="r in REGIONS" :key="r.region_id"
        class="rail-item justify-between group"
        :class="state.filters.region_ids.includes(r.region_id) ? 'bg-tint-gray text-charcoal' : ''"
        @click="regionFilter(r.region_id)"
      >
        <span class="flex items-center gap-2 truncate">
          <span class="h-1.5 w-1.5 rounded-full shrink-0" :style="{ background: dot[r.status] }" />
          <span class="truncate">{{ r.region_name }}</span>
        </span>
        <span class="text-[11px] text-stone uppercase">{{ r.cloud_provider }}</span>
      </button>
    </Section>

    <Section title="已存视图" :icon="LayoutTemplate">
      <button class="rail-item"><LayoutTemplate :size="13" class="text-stone shrink-0" /><span class="truncate">值班默认</span></button>
      <button class="rail-item"><LayoutTemplate :size="13" class="text-stone shrink-0" /><span class="truncate">FinOps 周报</span></button>
      <button class="rail-item text-steel"><Plus :size="13" class="shrink-0" /><span>新建视图</span></button>
    </Section>

    <Section title="最近作业" :icon="History">
      <button
        v-for="j in recentJobs" :key="j"
        class="rail-item font-mono text-[12.5px]" @click="m.setTab('jobs')"
      >
        <History :size="13" class="text-stone shrink-0" /><span class="truncate">{{ j }}</span>
      </button>
    </Section>
  </aside>
</template>

<script>
import { h } from 'vue'
// Lightweight section wrapper rendered inline to keep the rail in one file.
const Section = (props, { slots }) =>
  h('div', { class: 'mb-5' }, [
    h('div', { class: 'flex items-center gap-1.5 px-2 mb-1.5' }, [
      props.icon ? h(props.icon, { size: 12, class: 'text-stone' }) : null,
      h('span', { class: 'micro-label text-stone' }, props.title)
    ]),
    h('div', { class: 'space-y-0.5' }, slots.default ? slots.default() : [])
  ])
Section.props = ['title', 'icon']
export default { components: { Section } }
</script>

<style scoped>
.rail-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  height: 36px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13.5px;
  color: #37352f;
  text-align: left;
  transition: background-color 0.12s;
}
.rail-item:hover {
  background: #f0eeec;
}
</style>
