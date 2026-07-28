<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRoute } from "vue-router";
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
import {
  IconClose,
  IconHome,
  IconMinus,
  IconSetting,
  IconServer,
} from "@kousum/semi-icons-vue";

const route = useRoute();
const maximised = ref(false);

// 判断是否在 OAuth 页面
const isOAuthPage = computed(() => route.path === '/oauth');

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

    <nav v-if="!isOAuthPage" class="nav-buttons" aria-label="主导航">
      <router-link to="/" class="nav-link"><IconHome style="font-size: 16px" />首页</router-link>
      <router-link to="/tunnels" class="nav-link"><IconServer style="font-size: 16px" />隧道</router-link>
      <router-link to="/settings" class="nav-link"><IconSetting style="font-size: 16px" />设置</router-link>
    </nav>

    <div v-if="isWails()" class="window-controls">
      <Tooltip content="最小化"><Button theme="borderless" type="tertiary" icon @click="handleMinimize"><IconMinus /></Button></Tooltip>
      <Tooltip :content="maximised ? '还原' : '最大化'"><Button theme="borderless" type="tertiary" icon @click="handleMaximize"><span class="maximise-icon" /></Button></Tooltip>
      <Tooltip content="关闭"><Button class="close-button" theme="borderless" type="tertiary" icon @click="handleClose"><IconClose /></Button></Tooltip>
    </div>
  </header>
</template>

<style scoped>
.app-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 58px; padding: 0 12px 0 20px; border-bottom: 1px solid var(--app-border); background: color-mix(in srgb, var(--app-surface) 92%, transparent); backdrop-filter: blur(14px); box-sizing: border-box; }
.brand { display: flex; align-items: center; gap: 9px; min-width: 0; color: var(--app-text-strong); }
.brand strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.nav-buttons { display: flex; align-items: center; gap: 4px; padding: 4px; border: 1px solid var(--app-border); border-radius: 7px; background: var(--app-surface-muted); }
.nav-link { display: flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 13px; border-radius: 5px; color: var(--app-text); font-size: 13px; font-weight: 600; text-decoration: none; transition: background .16s ease, color .16s ease; }
.nav-link:hover { color: var(--app-text-strong); background: var(--app-surface); }
.nav-link.router-link-active { color: var(--app-accent); background: var(--app-surface); box-shadow: 0 1px 2px rgba(20, 24, 31, .08); }
.window-controls { display: flex; justify-self: end; align-items: center; gap: 2px; --wails-draggable: no-drag; }
.maximise-icon { display: block; width: 12px; height: 12px; border: 1.5px solid currentColor; box-sizing: border-box; }
.close-button:hover { color: #fff !important; background: #d7373f !important; }
@media (max-width: 620px) {
  .app-header { grid-template-columns: auto 1fr auto; padding-left: 12px; }
  .brand strong { display: none; }
  .nav-buttons { justify-self: center; }
  .nav-link { padding: 0 9px; }
  .nav-link svg { display: none; }
}
</style>
