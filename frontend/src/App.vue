<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppSidebar from "./components/AppSidebar.vue";
import AppNotification from "./components/AppNotification.vue";
import { useGlobalLoadingStore } from "@/stores/globalLoading";

const globalLoadingStore = useGlobalLoadingStore();
const route = useRoute();
const showNavigation = computed(() => route.path !== "/oauth");
const contentScroller = ref<HTMLElement | null>(null);
let scrollbarHideTimer: ReturnType<typeof setTimeout> | undefined;

function setScrollbarVisible() {
  const scroller = contentScroller.value;
  if (!scroller) return;

  clearTimeout(scrollbarHideTimer);
  scroller.classList.add("is-scrollbar-visible");
}

function hideScrollbarAfterDelay() {
  const scroller = contentScroller.value;
  if (!scroller) return;

  clearTimeout(scrollbarHideTimer);
  scrollbarHideTimer = setTimeout(() => scroller.classList.remove("is-scrollbar-visible"), 700);
}

function showScrollbarTemporarily() {
  setScrollbarVisible();
  hideScrollbarAfterDelay();
}

function handleScrollerPointerMove(event: PointerEvent) {
  const scroller = contentScroller.value;
  if (!scroller) return;

  const bounds = scroller.getBoundingClientRect();
  const verticalScrollbarWidth = scroller.offsetWidth - scroller.clientWidth;
  const horizontalScrollbarHeight = scroller.offsetHeight - scroller.clientHeight;
  const isOverVerticalScrollbar = verticalScrollbarWidth > 0
    && event.clientX >= bounds.right - verticalScrollbarWidth;
  const isOverHorizontalScrollbar = horizontalScrollbarHeight > 0
    && event.clientY >= bounds.bottom - horizontalScrollbarHeight;

  if (isOverVerticalScrollbar || isOverHorizontalScrollbar) {
    setScrollbarVisible();
    scroller.classList.add("is-scrollbar-hovered");
    return;
  }

  if (scroller.classList.contains("is-scrollbar-hovered")) {
    scroller.classList.remove("is-scrollbar-hovered");
    hideScrollbarAfterDelay();
  }
}

function handleScrollerPointerLeave() {
  const scroller = contentScroller.value;
  if (!scroller) return;

  scroller.classList.remove("is-scrollbar-hovered");
  hideScrollbarAfterDelay();
}

onBeforeUnmount(() => clearTimeout(scrollbarHideTimer));
</script>

<template>
  <div class="app-shell">
    <AppHeader style="--wails-draggable: drag" />
    <AppNotification />
    <div v-if="globalLoadingStore.isLoading" class="app-global-loading-bar" />
    <div class="app-workspace" :class="{ 'app-workspace--auth': !showNavigation }">
      <AppSidebar v-if="showNavigation" />
      <main
        ref="contentScroller"
        class="app-content-scroll"
        @pointerleave="handleScrollerPointerLeave"
        @pointermove="handleScrollerPointerMove"
        @scroll.passive="showScrollbarTemporarily"
      >
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

.app-workspace {
  display: flex;
  height: calc(100vh - 48px);
  min-height: 0;
  padding: 12px 12px 12px 0;
  box-sizing: border-box;
  background: var(--app-sidebar);
}
.app-workspace--auth { display: block; padding: 0; }
.app-content-scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
  clip-path: inset(0 round 14px);
}

.app-workspace--auth .app-content-scroll { height: 100%; border: 0; border-radius: 0; clip-path: none; }

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
  .app-workspace:not(.app-workspace--auth) { padding: 0; }
  .app-workspace:not(.app-workspace--auth) .app-content-scroll { padding-bottom: 58px; border: 0; border-radius: 0; clip-path: none; }
}
</style>
