<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue";
import {
  WindowMinimise,
  WindowToggleMaximise,
  WindowIsMaximised,
  EventsOn,
  EventsOff,
  Quit,
} from "../../wailsjs/runtime/runtime";
import AppLogo from "./AppLogo.vue";
import { isWails } from "@/services/platform";
import { Button, Tooltip } from "@kousum/semi-ui-vue";
import { Minus as IconMinus, Square as IconMaximize, X as IconClose } from "lucide-vue-next";

const maximised = ref(false);

const onToggleMaximize = (isMaximised: boolean) => {
  maximised.value = isMaximised;
};

onMounted(async () => {
  if (!isWails()) {
    return;
  }
  const isMax = await WindowIsMaximised();
  onToggleMaximize(isMax);

  EventsOn(
    "window_changed",
    (info: { fullscreen?: boolean; maximised?: boolean }) => {
      const { maximised: isMaximised } = info;
      if (isMaximised !== undefined) {
        onToggleMaximize(isMaximised);
      }
    },
  );
});

onUnmounted(() => {
  if (isWails()) {
    EventsOff("window_changed");
  }
});

async function handleMinimize() {
  WindowMinimise();
}

async function handleMaximize() {
  WindowToggleMaximise();
}

function handleClose() {
  Quit();
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
        <AppLogo :size="20" />
        <strong class="font-comfortaa">LoliaShizuku</strong>
    </div>

    <div v-if="isWails()" class="window-controls">
      <Tooltip content="最小化"><Button theme="borderless" type="tertiary" icon @click="handleMinimize"><IconMinus /></Button></Tooltip>
      <Tooltip :content="maximised ? '还原' : '最大化'"><Button theme="borderless" type="tertiary" icon @click="handleMaximize"><IconMaximize /></Button></Tooltip>
      <Tooltip content="关闭"><Button class="close-button" theme="borderless" type="tertiary" icon @click="handleClose"><IconClose /></Button></Tooltip>
    </div>
  </header>
</template>

<style scoped>
.app-header { display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 8px 0 18px; border-bottom: 1px solid var(--app-border); background: color-mix(in srgb, var(--app-surface) 92%, transparent); backdrop-filter: blur(14px); box-sizing: border-box; }
.brand { display: flex; align-items: center; gap: 9px; min-width: 0; color: var(--app-text-strong); }
.brand strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.window-controls { display: flex; justify-self: end; align-items: center; gap: 2px; --wails-draggable: no-drag; }
.close-button:hover { color: #fff !important; background: #d7373f !important; }
@media (max-width: 620px) {
  .app-header { padding-left: 12px; }
}
</style>
