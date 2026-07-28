<script lang="ts" setup>
import AppHeader from "./components/AppHeader.vue";
import FloatingActionButton from "./components/FloatingActionButton.vue";
import { useGlobalLoadingStore } from "@/stores/globalLoading";

const globalLoadingStore = useGlobalLoadingStore();
</script>

<template>
  <div class="app-shell">
    <AppHeader style="--wails-draggable: drag" />
    <div v-if="globalLoadingStore.isLoading" class="app-global-loading-bar" />
    <main class="app-content-scroll">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <div :key="route.name" class="app-page-wrap">
            <component :is="Component" />
          </div>
        </transition>
      </router-view>
    </main>
    <FloatingActionButton />
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

.app-content-scroll {
  height: calc(100vh - 58px);
  overflow-y: auto;
}

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
  top: 58px;
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
</style>
