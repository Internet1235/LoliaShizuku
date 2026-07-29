<script setup lang="ts">
import NotificationStatusIcon from "@/components/NotificationStatusIcon.vue";
import { useNotificationStore } from "@/stores/notification";

const notificationStore = useNotificationStore();
</script>

<template>
  <TransitionGroup
    name="app-notification"
    tag="div"
    class="app-notification-stack"
    aria-live="polite"
  >
    <div
      v-for="notification in notificationStore.notifications"
      :key="notification.id"
      class="app-notification"
      :data-type="notification.type"
      role="status"
      @click="notificationStore.dismiss(notification.id)"
    >
      <NotificationStatusIcon :type="notification.type" />
      <span>{{ notification.message }}</span>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.app-notification-stack {
  position: fixed;
  z-index: 4000;
  top: 62px;
  left: 50%;
  display: flex;
  width: min(380px, calc(100vw - 32px));
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transform: translateX(-50%);
  pointer-events: none;
}

.app-notification {
  display: flex;
  width: fit-content;
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
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: auto;
}

.app-notification-enter-active,
.app-notification-leave-active,
.app-notification-move { transition: opacity .18s ease, transform .18s ease; }
.app-notification-enter-from, .app-notification-leave-to { opacity: 0; transform: translateX(14px); }
.app-notification-leave-active { position: absolute; }

@media (max-width: 640px) {
  .app-notification-stack { top: 58px; width: calc(100vw - 24px); }
  .app-notification { max-width: 100%; }
}
</style>