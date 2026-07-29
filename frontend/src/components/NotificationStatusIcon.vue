<script setup lang="ts">
import IconCheck from "~icons/lucide/check";
import IconInfo from "~icons/lucide/info";

withDefaults(defineProps<{
  type?: "success" | "error" | "info";
}>(), {
  type: "info",
});
</script>

<template>
  <span class="notification-status-icon" :data-type="type" aria-hidden="true">
    <IconCheck v-if="type === 'success'" />
    <span v-else-if="type === 'error'" class="error-exclamation">!</span>
    <IconInfo v-else />
  </span>
</template>

<style scoped>
.notification-status-icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  border-radius: 50%;
  background: #168f63;
  color: #fff;
}

.notification-status-icon :deep(svg) { width: 15px; height: 15px; stroke-width: 2.5; }
.notification-status-icon[data-type="error"] { background: #d9363e; }
.error-exclamation { color: #fff; font: 900 17px/1 Arial, sans-serif; transform: translateY(-.5px); }
.notification-status-icon[data-type="info"] { background: var(--app-accent); }
</style>