<script setup lang="ts">
import IconCheck from "~icons/lucide/check";
import IconInfo from "~icons/lucide/info";
import IconAlert from "~icons/lucide/circle-alert";
import { useNotificationStore } from "@/stores/notification";

const notificationStore = useNotificationStore();
</script>

<template>
  <Transition name="app-notification" mode="out-in">
    <div
      v-if="notificationStore.visible"
      :key="notificationStore.notificationID"
      class="app-notification"
      :data-type="notificationStore.type"
      role="status"
      aria-live="polite"
      @click="notificationStore.dismiss"
    >
      <span class="app-notification-icon" aria-hidden="true">
        <IconCheck v-if="notificationStore.type === 'success'" />
        <IconAlert v-else-if="notificationStore.type === 'error'" />
        <IconInfo v-else />
      </span>
      <span>{{ notificationStore.message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.app-notification {
  position: fixed;
  z-index: 4000;
  top: 62px;
  left: 50%;
  display: flex;
  max-width: min(460px, calc(100vw - 32px));
  min-height: 46px;
  box-sizing: border-box;
  align-items: center;
  gap: 11px;
  padding: 10px 16px 10px 11px;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-panel);
  background: var(--app-surface);
  box-shadow: 0 10px 30px rgba(20, 24, 31, .16);
  color: var(--app-text-strong);
  font-size: 13px;
  transform: translateX(-50%);
  cursor: pointer;
}

.app-notification-icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 50%;
  background: #168f63;
  color: #fff;
}

.app-notification-icon :deep(svg) { width: 15px; height: 15px; stroke-width: 2.5; }
.app-notification[data-type="error"] .app-notification-icon { background: #d9363e; }
.app-notification[data-type="info"] .app-notification-icon { background: var(--app-accent); }
.app-notification-enter-active, .app-notification-leave-active { transition: opacity .18s ease, transform .18s ease; }
.app-notification-enter-from, .app-notification-leave-to { opacity: 0; transform: translate(-50%, -10px); }

@media (max-width: 640px) {
  .app-notification { top: 58px; width: calc(100vw - 24px); }
}
</style>