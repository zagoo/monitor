<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import {
  LayoutDashboard, Server, Boxes, TrendingUp, BellRing, Wallet, SlidersHorizontal
} from 'lucide-vue-next'
import { useMonitor } from './store/useMonitor.js'
import { TABS } from './data/catalog.js'

const TAB_ICONS = { LayoutDashboard, Server, Boxes, TrendingUp, BellRing, Wallet, SlidersHorizontal }

import TopBar from './components/shell/TopBar.vue'
import LeftRail from './components/shell/LeftRail.vue'

import OverviewPage from './components/pages/OverviewPage.vue'
import ResourcesPage from './components/pages/ResourcesPage.vue'
import JobsPage from './components/pages/JobsPage.vue'
import TrendsPage from './components/pages/TrendsPage.vue'
import AlertsPage from './components/pages/AlertsPage.vue'
import CostPage from './components/pages/CostPage.vue'
import SettingsPage from './components/pages/SettingsPage.vue'

import AcceleratorDrawer from './components/drawers/AcceleratorDrawer.vue'
import JobDrawer from './components/drawers/JobDrawer.vue'

const m = useMonitor()
const { state, counts } = m

const PAGES = {
  overview: OverviewPage, resources: ResourcesPage, jobs: JobsPage,
  trends: TrendsPage, alerts: AlertsPage, cost: CostPage, settings: SettingsPage
}
const ActivePage = computed(() => PAGES[state.activeTab])
const tabs = TABS

onMounted(() => m.startLive())
onUnmounted(() => m.stopLive())
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <TopBar />
    <div class="flex-1 flex min-h-0">
      <LeftRail />
      <main class="flex-1 min-w-0 bg-canvas overflow-y-auto scroll-thin">
        <div class="max-w-[1280px] mx-auto px-8 py-6">
          <!-- pill tabs (PRD §12.3.2) -->
          <nav class="flex items-center gap-2 mb-5 flex-wrap">
            <button
              v-for="t in tabs" :key="t.id"
              class="nz-pill" :class="state.activeTab === t.id ? 'nz-pill-active' : ''"
              @click="m.setTab(t.id)"
            >
              <component :is="TAB_ICONS[t.icon]" :size="14" />
              {{ t.label }}
              <span
                v-if="t.id === 'alerts' && counts.alerts"
                class="h-4 min-w-4 px-1 grid place-items-center rounded-full text-[10px] font-semibold"
                :class="state.activeTab === t.id ? 'bg-white/20 text-white' : 'bg-danger/12 text-danger'"
              >{{ counts.alerts }}</span>
            </button>
          </nav>

          <Transition name="page" mode="out-in">
            <component :is="ActivePage" :key="state.activeTab" />
          </Transition>
        </div>
      </main>
    </div>

    <!-- detail drawers -->
    <AcceleratorDrawer v-if="state.drawer?.type === 'accelerator'" :id="state.drawer.id" @close="m.closeDrawer()" />
    <JobDrawer v-if="state.drawer?.type === 'job'" :id="state.drawer.id" @close="m.closeDrawer()" />
  </div>
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
