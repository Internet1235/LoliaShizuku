<script lang="ts" setup>
import { onBeforeUnmount, onMounted, computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getRunnerRuntimeStatus } from "@/services/center";
import { Button, Tooltip } from "@kousum/semi-ui-vue";
import { IconTerminal } from "@kousum/semi-icons-vue";

const route = useRoute();
const runnerRunning = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const refreshRunnerStatus = async () => {
  try {
    const status = await getRunnerRuntimeStatus();
    runnerRunning.value = !!status.running;
  } catch {
    runnerRunning.value = false;
  }
};

const showFab = computed(
  () => runnerRunning.value && route.path !== "/oauth" && route.path !== "/runner",
);

onMounted(() => {
  void refreshRunnerStatus();
  timer = setInterval(() => {
    void refreshRunnerStatus();
  }, 3000);
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

watch(
  () => route.path,
  () => {
    void refreshRunnerStatus();
  },
);
</script>

<template>
  <Tooltip v-if="showFab" content="查看 Runner">
    <router-link class="fab-global" to="/runner" aria-label="查看 Runner">
      <Button theme="solid" type="primary" size="large" icon><IconTerminal style="font-size: 19px" /></Button>
    </router-link>
  </Tooltip>
</template>

<style scoped>
.fab-global {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
}
.fab-global :deep(.semi-button) { width: 44px; height: 44px; border-radius: 50%; box-shadow: 0 8px 24px color-mix(in srgb, var(--app-accent) 35%, transparent); }
</style>
