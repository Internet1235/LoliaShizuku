<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { Banner, Button, Card, Progress, Tag } from "@kousum/semi-ui-vue";
import {
  IconCloud,
  IconCopy,
  IconDelete,
  IconDownload,
  IconExternalOpen,
  IconGithubLogo,
  IconInfoCircle,
  IconColorPalette,
  IconRefresh,
  IconStop,
  IconUser,
} from "@kousum/semi-icons-vue";
import AppLogo from "@/components/AppLogo.vue";
import { useGlobalLoadingStore } from "@/stores/globalLoading";
import { useNotificationStore, type NotificationType } from "@/stores/notification";
import { useFrpcInstallStore } from "@/stores/frpcInstall";
import {
  getFrpcStatus,
  removeFrpc,
  setMirrorConfig,
  type FrpcMirrorConfig,
  type FrpcStatus,
} from "@/services/frpc";
import { clearOAuthToken } from "@/services/auth";
import { apiRequest } from "@/services/http";
import { isWails, openExternalURL } from "@/services/platform";
import { stopRunner } from "@/services/center";
import { GetVersionInfo } from "../../../wailsjs/go/backend/App";
import type { version } from "../../../wailsjs/go/models";

defineOptions({
  name: "SettingsPage",
});

type SettingsPanel = "appearance" | "frpc" | "about" | "account";
type MirrorMode = "official" | "builtin" | "custom";
type CustomMirrorMode = "base" | "template";
type ThemeMode = "system" | "light" | "dark";

const router = useRouter();
const prefersDarkMedia =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

const status = ref<FrpcStatus | null>(null);
const activePanel = ref<SettingsPanel>("frpc");
const mirrorMode = ref<MirrorMode>("official");
const builtinMirrorPresetID = ref("");
const customMirrorMode = ref<CustomMirrorMode>("base");
const customMirrorBaseURL = ref("");
const customMirrorURLTemplate = ref("");
const themeMode = ref<ThemeMode>("system");
const showMirrorSwitchHint = ref(false);
const logoutLoading = ref(false);

const themeStorageKey = "lolia.theme";

const mirrorModeItems = [
  { title: "github.com", value: "official" as const },
  { title: "内置镜像", value: "builtin" as const },
  { title: "自定义网址", value: "custom" as const },
];

const customMirrorModeItems = [
  { title: "基础地址", value: "base" as const },
  { title: "URL 模板", value: "template" as const },
];

const themeModeItems = [
  { title: "跟随系统", value: "system" as const },
  { title: "浅色模式", value: "light" as const },
  { title: "深色模式", value: "dark" as const },
];

const globalLoadingStore = useGlobalLoadingStore();
const withGlobalLoading = <T>(task: () => Promise<T>) =>
  globalLoadingStore.withGlobalLoading(task);
const notificationStore = useNotificationStore();

const frpcInstallStore = useFrpcInstallStore();
const { installing, canceling, phase, downloaded, total, percent, indeterminate } =
  storeToRefs(frpcInstallStore);
const { startInstall, cancelInstall } = frpcInstallStore;

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const phaseLabel = computed(() => {
  switch (phase.value) {
    case "resolving":
      return "正在获取最新版本…";
    case "downloading":
      return "正在下载…";
    case "verifying":
      return "正在校验文件…";
    case "extracting":
      return "正在解压安装…";
    case "done":
      return "安装完成";
    default:
      return "准备中…";
  }
});

const progressDetail = computed(() => {
  if (phase.value !== "downloading" || total.value <= 0) {
    return "";
  }
  return `${formatBytes(downloaded.value)} / ${formatBytes(total.value)}`;
});

const showMessage = (
  text: string,
  color: NotificationType = "info",
) => {
  notificationStore.show(text, color);
};

const panelTitle = computed(() => {
  switch (activePanel.value) {
    case "appearance":
      return "外观设置";
    case "frpc":
      return "frpc 管理";
    case "about":
      return "关于";
    case "account":
      return "账号";
    default:
      return "设置";
  }
});

const installedVersion = computed(
  () => status.value?.installed?.version || "未安装",
);
const latestVersion = computed(() => status.value?.latest?.tag_name || "-");
const builtinMirrorItems = computed(() =>
  (status.value?.builtin_mirrors ?? []).map((preset) => ({
    title: preset.name || preset.id,
    value: preset.id,
    props: {
      subtitle:
        preset.description ||
        preset.base_url ||
        preset.url_template ||
        "未提供描述",
    },
  })),
);
const mirrorConfigDirty = computed(() => {
  const saved = status.value?.mirror_config;
  if (!saved) {
    return false;
  }

  const savedMode = saved.mode || "official";
  if (mirrorMode.value !== savedMode) {
    return true;
  }
  if (mirrorMode.value === "builtin") {
    return builtinMirrorPresetID.value !== (saved.preset_id || "");
  }
  if (mirrorMode.value === "custom") {
    if (customMirrorMode.value === "template") {
      return (
        customMirrorURLTemplate.value.trim() !== (saved.custom_url_template || "")
      );
    }
    return customMirrorBaseURL.value.trim() !== (saved.custom_base_url || "");
  }
  return false;
});
const actionText = computed(() => {
  if (!status.value?.installed?.binary_exists) {
    return "安装 frpc";
  }
  if (status.value.update_available) {
    return "更新 frpc";
  }
  return "重装 frpc";
});

const frpcInstalled = computed(() => !!status.value?.installed?.binary_exists);
const updateAvailable = computed(() => !!status.value?.update_available);

const frpcStatusChip = computed(() => {
  if (!frpcInstalled.value) {
    return { text: "未安装", color: "grey" };
  }
  if (status.value?.latest_error) {
    return { text: "已安装", color: "green" };
  }
  if (updateAvailable.value) {
    return { text: "可更新", color: "orange" };
  }
  return { text: "已是最新", color: "green" };
});

const installDetails = computed(() => [
  { label: "当前版本", value: installedVersion.value },
  {
    label: "二进制",
    value: frpcInstalled.value ? "已安装" : "未安装",
  },
  {
    label: "安装时间",
    value: formatTime(status.value?.installed?.installed_at),
  },
]);

const pathItems = computed(() => {
  const paths = status.value?.paths;
  return [
    { label: "userdata", value: paths?.userdata_dir },
    { label: "frpc", value: paths?.frpc_dir },
    { label: "bin", value: paths?.bin_dir },
    { label: "binary", value: paths?.binary_path },
    { label: "downloads", value: paths?.download_dir },
    { label: "state", value: paths?.state_path },
    { label: "settings", value: paths?.settings_path },
  ];
});

const latestDetails = computed(() => [
  { label: "最新标签", value: latestVersion.value },
  {
    label: "可更新",
    value: updateAvailable.value ? "是" : "否",
  },
]);

const formatTime = (value?: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const openURL = (url: string) => {
  openExternalURL(url);
};

const copyPath = async (value?: string) => {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    showMessage("已复制路径", "success");
  } catch {
    showMessage("复制失败", "error");
  }
};

const versionInfo = ref<version.Info | null>(null);

const loadVersionInfo = async () => {
  try {
    versionInfo.value = isWails()
      ? await GetVersionInfo()
      : await apiRequest<version.Info>("/api/version");
  } catch {
    versionInfo.value = null;
  }
};

const appVersion = computed(() => versionInfo.value?.version || "-");

const aboutDetails = computed(() => {
  const info = versionInfo.value;
  if (!info) {
    return [] as Array<{ label: string; value: string }>;
  }
  const shortCommit =
    info.git_commit && info.git_commit.length > 7
      ? info.git_commit.slice(0, 7)
      : info.git_commit || "-";
  return [
    { label: "版本", value: info.version || "-" },
    { label: "提交", value: shortCommit },
    { label: "分支", value: info.git_branch || "-" },
    { label: "构建时间", value: info.build_time || "-" },
    { label: "平台", value: info.platform || "-" },
    { label: "Go", value: info.go_version || "-" },
  ];
});

const aboutLinks = [
  {
    label: "项目仓库",
    color: "primary",
    url: "https://github.com/Mxmilu666/LoliaShizuku",
  },
  {
    label: "Lolia 控制台",
    color: "primary",
    url: "https://dash.lolia.link",
  },
  {
    label: "Lolia 官网",
    color: "secondary",
    url: "https://lolia.link",
  },
  {
    label: "Wails",
    color: "secondary",
    url: "https://wails.io",
  },
];

const getSystemThemeName = (): "light" | "dark" =>
  prefersDarkMedia?.matches ? "dark" : "light";

const resolveThemeName = (mode: ThemeMode): "light" | "dark" => {
  if (mode === "system") {
    return getSystemThemeName();
  }
  return mode;
};

const handleSystemThemePreferenceChange = () => {
  if (themeMode.value === "system") {
    document.body.setAttribute("theme-mode", getSystemThemeName());
  }
};

const applyTheme = (mode: ThemeMode) => {
  document.body.setAttribute("theme-mode", resolveThemeName(mode));
  try {
    localStorage.setItem(themeStorageKey, mode);
  } catch {
    // ignore localStorage errors
  }
};

const initTheme = () => {
  let resolvedTheme: ThemeMode = "system";
  try {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (
      savedTheme === "system" ||
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "lightTheme" ||
      savedTheme === "darkTheme"
    ) {
      resolvedTheme = savedTheme === "lightTheme" ? "light" : savedTheme === "darkTheme" ? "dark" : savedTheme;
    }
  } catch {
    // ignore localStorage errors
  }

  themeMode.value = resolvedTheme;
  applyTheme(resolvedTheme);
};

const handleThemeChange = (value: string | null) => {
  let nextTheme: ThemeMode = "light";
  if (value === "system") {
    nextTheme = "system";
  } else if (value === "dark") {
    nextTheme = "dark";
  }

  themeMode.value = nextTheme;
  applyTheme(nextTheme);
  showMessage("主题已切换", "success");
};

const syncMirrorForm = (nextStatus: FrpcStatus) => {
  const config = nextStatus.mirror_config;
  mirrorMode.value = config?.mode || "official";
  builtinMirrorPresetID.value = config?.preset_id || "";
  customMirrorBaseURL.value = config?.custom_base_url || "";
  customMirrorURLTemplate.value = config?.custom_url_template || "";
  customMirrorMode.value = customMirrorURLTemplate.value ? "template" : "base";

  if (!builtinMirrorPresetID.value && nextStatus.builtin_mirrors?.length) {
    builtinMirrorPresetID.value = nextStatus.builtin_mirrors[0].id;
  }
};

const loadStatus = async () => {
  await withGlobalLoading(async () => {
    try {
      status.value = await getFrpcStatus();
      syncMirrorForm(status.value);
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "获取 frpc 状态失败",
        "error",
      );
    }
  });
};

const handleInstallOrUpdate = async () => {
  showMirrorSwitchHint.value = false;
  try {
    await withGlobalLoading(async () => {
      const result = await startInstall();
      status.value = result.status;
      syncMirrorForm(result.status);
      showMessage(`frpc 已安装到 ${result.status.paths.binary_path}`, "success");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "安装/更新 frpc 失败";
    if (message.includes("已终止")) {
      showMessage(message, "info");
      await loadStatus();
      return;
    }
    if (message.includes("下载失败") || message.includes("下载超时")) {
      showMirrorSwitchHint.value = true;
    }
    showMessage(message, "error");
  }
};

const handleCancelInstall = async () => {
  if (!installing.value || canceling.value) {
    return;
  }

  try {
    await cancelInstall();
    showMessage("已发送终止下载请求", "info");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "终止下载失败", "error");
  }
};

const handleRemove = async () => {
  await withGlobalLoading(async () => {
    try {
      await removeFrpc();
      showMessage("本地 frpc 已移除", "success");
      await loadStatus();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "移除 frpc 失败", "error");
    }
  });
};

const handleSaveMirrorConfig = async () => {
  await withGlobalLoading(async () => {
    try {
      const config: FrpcMirrorConfig = {
        mode: mirrorMode.value,
      };

      if (mirrorMode.value === "builtin") {
        if (!builtinMirrorPresetID.value) {
          showMessage("请选择一个内置镜像", "error");
          return;
        }
        config.preset_id = builtinMirrorPresetID.value;
      } else if (mirrorMode.value === "custom") {
        if (customMirrorMode.value === "template") {
          const template = customMirrorURLTemplate.value.trim();
          if (!template) {
            showMessage("请填写自定义 URL 模板", "error");
            return;
          }
          config.custom_url_template = template;
        } else {
          const baseURL = customMirrorBaseURL.value.trim();
          if (!baseURL) {
            showMessage("请填写自定义镜像基础地址", "error");
            return;
          }
          config.custom_base_url = baseURL;
        }
      }

      await setMirrorConfig(config);
      showMirrorSwitchHint.value = false;
      showMessage("下载源设置已保存", "success");
      await loadStatus();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "保存下载源失败", "error");
    }
  });
};

const handleUseOfficialMirror = async () => {
  mirrorMode.value = "official";
  customMirrorBaseURL.value = "";
  customMirrorURLTemplate.value = "";
  await handleSaveMirrorConfig();
};

const handleLogout = async () => {
  if (logoutLoading.value) {
    return;
  }

  logoutLoading.value = true;
  try {
    await stopRunner();
    await clearOAuthToken();
    showMessage("已退出登录", "success");
    await router.replace("/oauth");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "退出登录失败", "error");
  } finally {
    logoutLoading.value = false;
  }
};

onMounted(() => {
  initTheme();
  if (prefersDarkMedia && typeof prefersDarkMedia.addEventListener === "function") {
    prefersDarkMedia.addEventListener("change", handleSystemThemePreferenceChange);
  }
  void loadStatus();
  void loadVersionInfo();
});

onBeforeUnmount(() => {
  if (prefersDarkMedia && typeof prefersDarkMedia.removeEventListener === "function") {
    prefersDarkMedia.removeEventListener("change", handleSystemThemePreferenceChange);
  }
});
</script>

<template>
  <div class="settings-page">
    <aside class="settings-nav">
      <div class="nav-label">设置菜单</div>
      <button :class="{ active: activePanel === 'frpc' }" @click="activePanel = 'frpc'"><IconCloud />frpc 管理</button>
      <button :class="{ active: activePanel === 'appearance' }" @click="activePanel = 'appearance'"><IconColorPalette />外观</button>
      <button :class="{ active: activePanel === 'about' }" @click="activePanel = 'about'"><IconInfoCircle />关于</button>
      <button :class="{ active: activePanel === 'account' }" @click="activePanel = 'account'"><IconUser />账号</button>
    </aside>

    <Card class="settings-content" :bordered="true" :body-style="{ padding: '0' }">
      <header class="settings-heading"><h1>{{ panelTitle }}</h1><Tag v-if="activePanel === 'frpc'" color="blue" type="ghost">{{ status?.goos || '-' }}/{{ status?.goarch || '-' }}</Tag></header>

      <div v-if="activePanel === 'appearance'" class="panel-stack">
        <section class="setting-section"><h2>主题模式</h2><select v-model="themeMode" class="form-control" @change="handleThemeChange(themeMode)"><option v-for="item in themeModeItems" :key="item.value" :value="item.value">{{ item.title }}</option></select><p>支持跟随系统、浅色、深色模式，设置会自动保存到本地。</p></section>
      </div>

      <div v-else-if="activePanel === 'frpc'" class="panel-stack">
        <section class="frpc-hero"><div><div class="frpc-title"><h2>frpc</h2><Tag v-if="frpcInstalled" color="pink" type="light">{{ installedVersion }}</Tag><Tag :color="frpcStatusChip.color" type="solid">{{ frpcStatusChip.text }}</Tag></div><p>最新版本 {{ latestVersion }}</p></div><Button theme="solid" type="primary" :loading="installing" :disabled="installing" @click="handleInstallOrUpdate"><IconDownload />{{ actionText }}</Button></section>
        <div class="action-row"><Button theme="light" type="warning" :loading="canceling" :disabled="!installing || canceling" @click="handleCancelInstall"><IconStop />终止下载</Button><Button theme="light" type="tertiary" :disabled="installing" @click="loadStatus"><IconRefresh />检查更新</Button><Button theme="light" type="danger" :disabled="installing" @click="handleRemove"><IconDelete />删除本地 frpc</Button></div>
        <section v-if="installing" class="setting-section"><div class="progress-label"><span>{{ phaseLabel }}</span><span>{{ progressDetail || `${Math.floor(percent)}%` }}</span></div><Progress :percent="percent" :show-info="false" :indeterminate="indeterminate" /> </section>
        <Banner v-if="showMirrorSwitchHint" type="warning" description="frpc 下载失败或超时，可能是当前下载源网络不佳，建议切换镜像后重试。" close-icon @close="showMirrorSwitchHint = false" />
        <Banner v-if="status?.latest_error" type="warning" :description="`获取最新版本失败：${status.latest_error}`" />
        <div class="detail-grid"><section class="setting-section"><h2>安装状态</h2><dl><template v-for="detail in installDetails" :key="detail.label"><dt>{{ detail.label }}</dt><dd>{{ detail.value }}</dd></template></dl></section><section class="setting-section"><h2>最新版本</h2><dl><template v-for="detail in latestDetails" :key="detail.label"><dt>{{ detail.label }}</dt><dd>{{ detail.value }}</dd></template></dl></section></div>
        <section class="setting-section mirror-section"><h2>GitHub 下载源</h2><label>来源<select v-model="mirrorMode" class="form-control" :disabled="installing"><option v-for="item in mirrorModeItems" :key="item.value" :value="item.value">{{ item.title }}</option></select></label><label v-if="mirrorMode === 'builtin'">镜像<select v-model="builtinMirrorPresetID" class="form-control" :disabled="installing"><option v-for="item in builtinMirrorItems" :key="item.value" :value="item.value">{{ item.title }}</option></select></label><Banner v-if="mirrorMode === 'builtin' && !builtinMirrorItems.length" type="info" description="当前未配置内置镜像，请改用官方源或自定义源。" /><label v-if="mirrorMode === 'custom'">自定义方式<select v-model="customMirrorMode" class="form-control" :disabled="installing"><option v-for="item in customMirrorModeItems" :key="item.value" :value="item.value">{{ item.title }}</option></select></label><input v-if="mirrorMode === 'custom' && customMirrorMode === 'base'" v-model="customMirrorBaseURL" class="form-control" placeholder="https://example.com/github.com" :disabled="installing" /><input v-if="mirrorMode === 'custom' && customMirrorMode === 'template'" v-model="customMirrorURLTemplate" class="form-control" placeholder="https://mirrors.example.com/{owner}/{repo}/{tag}/{asset}" :disabled="installing" /><p v-if="mirrorMode === 'custom' && customMirrorMode === 'template'">可用占位符：{owner}、{repo}、{tag}、{asset}</p><Banner v-if="mirrorConfigDirty" type="warning" description="下载源修改尚未保存，点击保存设置后生效。" /><div class="action-row"><Button theme="light" type="primary" :disabled="installing" @click="handleSaveMirrorConfig">保存设置</Button><Button theme="borderless" type="tertiary" :disabled="installing" @click="handleUseOfficialMirror">使用 github.com</Button></div></section>
        <section class="setting-section"><h2>本地目录</h2><div class="path-list"><div v-for="path in pathItems" :key="path.label" class="path-row"><span>{{ path.label }}</span><code :title="path.value">{{ path.value || '-' }}</code><Button theme="borderless" type="tertiary" size="small" :disabled="!path.value" aria-label="复制路径" @click="copyPath(path.value)"><IconCopy /></Button></div></div></section>
      </div>

      <div v-else-if="activePanel === 'about'" class="panel-stack">
        <section class="about-hero"><div class="about-logo"><AppLogo :size="44" /></div><div><div class="frpc-title"><h2>LoliaShizuku</h2><Tag color="pink" type="solid">v{{ appVersion }}</Tag></div><p>「ロリア・雫」由 Wails 驱动的 Lolia FRP 第三方客户端</p></div></section>
        <section class="setting-section"><h2>构建信息</h2><div v-if="aboutDetails.length" class="about-grid"><div v-for="detail in aboutDetails" :key="detail.label"><span>{{ detail.label }}</span><strong>{{ detail.value }}</strong></div></div><p v-else>无法获取构建信息。</p></section>
        <section class="setting-section"><h2>相关链接</h2><div class="action-row"><Button v-for="link in aboutLinks" :key="link.url" theme="light" type="primary" @click="openURL(link.url)"><IconGithubLogo v-if="link.url.includes('github')" /><IconExternalOpen v-else />{{ link.label }}</Button></div></section>
        <p class="about-footer">以 MIT 许可证开源 · Made with ♥ by Mxmilu666</p>
      </div>

      <div v-else class="panel-stack"><Banner type="warning" description="退出后将清除本地 OAuth 凭据，并停止当前本地 Runner。" /><div><Button theme="solid" type="danger" :loading="logoutLoading" :disabled="logoutLoading" @click="handleLogout"><IconUser />退出登录</Button></div></div>
    </Card>
  </div>
</template>

<style scoped>
.settings-page { position: relative; display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 16px; min-height: calc(100vh - 106px); }
.settings-nav { display: flex; flex-direction: column; gap: 4px; padding: 14px 8px; align-self: start; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface); }
.nav-label { padding: 8px 12px; color: var(--app-text); font-size: 11px; font-weight: 700; text-transform: uppercase; }
.settings-nav button { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 0 12px; border: 0; border-radius: var(--app-radius-control); color: var(--app-text); background: transparent; cursor: pointer; text-align: left; transition: color .16s ease, background .16s ease; }
.settings-nav button:hover, .settings-nav button:focus-visible { color: var(--app-text-strong); background: var(--app-nav-hover); outline: none; }
.settings-nav button.active { color: var(--app-accent); background: transparent; font-weight: 600; }
.settings-content { min-width: 0; overflow: hidden; border-radius: var(--app-radius-panel); background: var(--app-surface); border-color: var(--app-border); }
.settings-heading { display: flex; align-items: center; justify-content: space-between; min-height: 62px; padding: 0 22px; border-bottom: 1px solid var(--app-border); }
.settings-heading h1 { margin: 0; color: var(--app-text-strong); font-size: 18px; letter-spacing: 0; }
.panel-stack { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.setting-section { padding: 16px; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface-muted); }
.setting-section h2 { margin: 0 0 14px; color: var(--app-text-strong); font-size: 14px; letter-spacing: 0; }
.setting-section p, .frpc-hero p, .about-hero p { margin: 8px 0 0; color: var(--app-text); font-size: 12px; line-height: 1.6; }
.form-control { box-sizing: border-box; width: 100%; min-height: 36px; padding: 7px 10px; border: 1px solid var(--app-border); border-radius: var(--app-radius-control); outline: none; color: var(--app-text-strong); background: var(--app-surface); transition: border-color .16s ease, box-shadow .16s ease; }
.form-control:hover:not(:disabled) { border-color: color-mix(in srgb, var(--app-text) 55%, var(--app-border)); }
.form-control:focus { border-color: var(--app-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-accent) 12%, transparent); }
.mirror-section { display: flex; flex-direction: column; gap: 12px; }
.mirror-section h2 { margin-bottom: 2px; }.mirror-section label { display: flex; flex-direction: column; gap: 6px; color: var(--app-text); font-size: 12px; }
.action-row, .frpc-title { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; }
.frpc-hero, .about-hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px; border: 1px solid color-mix(in srgb, var(--app-accent) 25%, var(--app-border)); border-radius: var(--app-radius-panel); background: color-mix(in srgb, var(--app-accent) 7%, var(--app-surface)); }
.frpc-title h2 { margin: 0; color: var(--app-text-strong); font-size: 20px; letter-spacing: 0; }
.progress-label { display: flex; justify-content: space-between; margin-bottom: 10px; color: var(--app-text); font-size: 12px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
dl { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin: 0; font-size: 13px; }dt { color: var(--app-text); }dd { margin: 0; color: var(--app-text-strong); font-weight: 600; text-align: right; }
.path-list { display: flex; flex-direction: column; }.path-row { display: grid; grid-template-columns: 78px minmax(0, 1fr) 30px; align-items: center; gap: 8px; min-height: 38px; border-bottom: 1px solid var(--app-border); }.path-row:last-child { border-bottom: 0; }.path-row span { color: var(--app-text); font-size: 12px; }.path-row code { overflow: hidden; color: var(--app-text-strong); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.about-logo { display: grid; place-items: center; width: 68px; height: 68px; flex: 0 0 68px; border-radius: var(--app-radius-control); color: var(--app-accent); background: var(--app-surface); }
.about-hero { justify-content: flex-start; }.about-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }.about-grid span, .about-grid strong { display: block; }.about-grid span { color: var(--app-text); font-size: 11px; }.about-grid strong { overflow-wrap: anywhere; margin-top: 5px; color: var(--app-text-strong); font-size: 13px; }.about-footer { margin: 0; color: var(--app-text); font-size: 11px; text-align: center; }
@media (max-width: 760px) { .settings-page { grid-template-columns: 1fr; }.settings-nav { flex-direction: row; overflow-x: auto; padding: 7px; }.nav-label { display: none; }.settings-nav button { flex: 0 0 auto; }.detail-grid, .about-grid { grid-template-columns: 1fr; }.frpc-hero { align-items: stretch; flex-direction: column; }.path-row { grid-template-columns: 64px minmax(0, 1fr) 30px; }.panel-stack { padding: 14px; } }
</style>
