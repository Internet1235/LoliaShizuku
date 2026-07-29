<script lang="ts" setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import { useGlobalLoadingStore } from "@/stores/globalLoading";

const globalLoadingStore = useGlobalLoadingStore();
const route = useRoute();
const showNavigation = computed(() => route.path !== "/oauth");
</script>

<template>
  <div class="app-shell">
    <AppHeader style="--wails-draggable: drag" />
    <div v-if="globalLoadingStore.isLoading" class="app-global-loading-bar" />
    <div class="app-workspace" :class="{ 'app-workspace--auth': !showNavigation }">
      <AppSidebar v-if="showNavigation" />
      <main class="app-content-scroll">
        <router-view v-slot="{ Component, route: currentRoute }">
          <transition name="fade" mode="out-in">
            <div :key="currentRoute.name" class="app-page-wrap">
              <component :is="Component" />
            </div>
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.app-workspace { display: flex; height: calc(100vh - 48px); min-height: 0; }
.app-workspace--auth { display: block; }
.app-content-scroll {
  min-width: 0;
  height: 100%;
  flex: 1;
  overflow-y: auto;
  background: var(--app-surface);
}

.app-content-scroll.is-modal-open { overflow: hidden; }

.app-page-wrap {
  width: 100%;
  min-height: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  box-sizing: border-box;
}

.app-global-loading-bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 48px;
  height: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--app-accent) 22%, transparent);
  z-index: 2000;
  pointer-events: none;
}

.app-global-loading-bar::after {
  position: absolute;
  inset: 0;
  width: 38%;
  background: var(--app-accent);
  animation: loading-slide 1s ease-in-out infinite;
  content: "";
}

@keyframes loading-slide {
  from { transform: translateX(-110%); }
  to { transform: translateX(300%); }
}

@media (max-width: 700px) {
  .app-page-wrap { padding: 16px; }
}
@media (max-width: 640px) {
  .app-workspace:not(.app-workspace--auth) .app-content-scroll { padding-bottom: 58px; }
}
</style>
