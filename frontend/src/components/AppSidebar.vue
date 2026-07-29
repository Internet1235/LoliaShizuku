<script setup lang="ts">
import {
  IconHome,
  IconServer,
  IconSetting,
} from "@kousum/semi-icons-vue";

const navigation = [
  { to: "/", label: "首页", icon: IconHome },
  { to: "/tunnels", label: "隧道", icon: IconServer },
  { to: "/settings", label: "设置", icon: IconSetting },
];
</script>

<template>
  <aside class="app-sidebar">
    <div class="sidebar-label">工作台</div>
    <nav class="sidebar-nav" aria-label="主导航">
      <router-link
        v-for="item in navigation"
        :key="item.to"
        :to="item.to"
        class="sidebar-link"
        :aria-label="item.label"
      >
        <component :is="item.icon" class="sidebar-icon" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
    <div class="sidebar-meta">
      <span>LOLiA</span>
      <small>FRP CLIENT</small>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: 208px;
  min-width: 208px;
  height: 100%;
  padding: 18px 12px 14px;
  border-right: 1px solid var(--app-border);
  box-sizing: border-box;
  background: var(--app-sidebar);
}
.sidebar-label {
  padding: 0 10px 9px;
  color: var(--app-text);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 40px;
  padding: 0 11px;
  border-radius: var(--app-radius-control);
  color: var(--app-text);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color .16s ease, background .16s ease;
}
.sidebar-link:hover { color: var(--app-text-strong); background: var(--app-nav-hover); }
.sidebar-link.router-link-active {
  color: var(--app-accent);
  background: transparent;
}
.sidebar-icon { flex: 0 0 auto; font-size: 17px; }
.sidebar-meta { display: flex; flex-direction: column; gap: 2px; margin-top: auto; padding: 12px 10px 2px; color: var(--app-text); }
.sidebar-meta span { font: 700 11px/1 "Comfortaa", sans-serif; letter-spacing: 0; }
.sidebar-meta small { font-size: 8px; letter-spacing: 1.2px; }

@media (max-width: 900px) and (min-width: 641px) {
  .app-sidebar { width: 64px; min-width: 64px; padding-inline: 9px; }
  .sidebar-label, .sidebar-link span, .sidebar-meta { display: none; }
  .sidebar-link { justify-content: center; padding: 0; }
}

@media (max-width: 640px) {
  .app-sidebar {
    position: fixed;
    z-index: 1000;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    min-width: 0;
    height: 58px;
    padding: 5px 8px;
    border-top: 1px solid var(--app-border);
    border-right: 0;
  }
  .sidebar-label, .sidebar-meta { display: none; }
  .sidebar-nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .sidebar-link { flex-direction: column; justify-content: center; gap: 2px; min-height: 47px; padding: 0; font-size: 10px; }
  .sidebar-icon { font-size: 17px; }
}
</style>