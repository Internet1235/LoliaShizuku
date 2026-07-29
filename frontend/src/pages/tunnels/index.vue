<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { Banner, Button, Dropdown, Empty, Input, Modal, Tag, type DropDownMenuItem } from "@kousum/semi-ui-vue";
import IconArrowDown from "~icons/lucide/arrow-down";
import IconArrowUp from "~icons/lucide/arrow-up";
import IconCheckCircleStroked from "~icons/lucide/circle-check";
import IconCopy from "~icons/lucide/copy";
import IconEdit from "~icons/lucide/pencil";
import IconFile from "~icons/lucide/file-text";
import IconGlobe from "~icons/lucide/globe-2";
import IconInfoCircle from "~icons/lucide/info";
import IconMapPin from "~icons/lucide/map-pin";
import IconMore from "~icons/lucide/ellipsis-vertical";
import IconPlay from "~icons/lucide/play";
import IconPower from "~icons/lucide/power";
import IconPlus from "~icons/lucide/plus";
import IconRefresh from "~icons/lucide/refresh-cw";
import IconRestart from "~icons/lucide/rotate-cw";
import IconSave from "~icons/lucide/save";
import IconSearch from "~icons/lucide/search";
import IconServer from "~icons/lucide/server";
import IconTrash from "~icons/lucide/trash-2";
import {
  createTunnel,
  deleteTunnel,
  getNodes,
  getRunnerRuntimeStatus,
  getTunnelDetail,
  getTunnelRunnerRuntimeStatus,
  getTunnelsOverview,
  startRunner,
  stopTunnelRunner,
  updateTunnel,
  type CreateTunnelInput,
  type NodeItem,
  type RunnerRuntimeStatus,
  type TunnelDetailData,
  type TunnelOverviewItem,
  type UpdateTunnelInput,
} from "@/services/center";
import { useGlobalLoadingStore } from "@/stores/globalLoading";
import { useNotificationStore } from "@/stores/notification";
import NotificationStatusIcon from "@/components/NotificationStatusIcon.vue";
import AppLogo from "@/components/AppLogo.vue";

defineOptions({
  name: "TunnelsPage",
});

const searchQuery = ref("");
const tunnels = ref<TunnelOverviewItem[]>([]);
const nodes = ref<NodeItem[]>([]);
const createModalVisible = ref(false);
const loadingNodes = ref(false);
const creatingTunnel = ref(false);
const createError = ref("");
const createForm = reactive<Omit<CreateTunnelInput, "local_port" | "remote_port"> & {
  local_port: number | null;
  remote_port: number | null;
}>({
  node_id: 0,
  type: "tcp",
  local_ip: "",
  local_port: null,
  remote_port: null,
  custom_domain: "",
  remark: "",
});
const globalLoadingStore = useGlobalLoadingStore();
const notificationStore = useNotificationStore();
const withGlobalLoading = <T,>(task: () => Promise<T>) =>
  globalLoadingStore.withGlobalLoading(task);
const runnerStatus = ref<RunnerRuntimeStatus>({
  running: false,
  pid: 0,
  started_at: "",
  tunnel_name: "",
  tunnel_names: [],
  command: "",
  last_error: "",
  log_lines: [],
});
const startingTunnelName = ref("");
const actionMenuKey = ref("");
const detailModalVisible = ref(false);
const detailLoading = ref(false);
const detailSaving = ref(false);
const detailError = ref("");
const detailTab = ref<"overview" | "settings">("overview");
const tunnelDetail = ref<TunnelDetailData | null>(null);
const logModalVisible = ref(false);
const logLoading = ref(false);
const logError = ref("");
const logTunnelName = ref("");
const logTunnelRemark = ref("");
const logStatus = ref<RunnerRuntimeStatus | null>(null);
const deleteModalVisible = ref(false);
const deletingTunnel = ref(false);
const tunnelPendingDelete = ref<TunnelOverviewItem | null>(null);
let logRefreshTimer: ReturnType<typeof setInterval> | null = null;
const detailForm = reactive<UpdateTunnelInput>({
  local_ip: "",
  local_port: 0,
  custom_domain: "",
  remark: "",
  config: {
    auto_tls: false,
    proxy_protocol_version: "",
    protocol: "tcp",
  },
});

const filteredTunnels = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) {
    return tunnels.value;
  }

  return tunnels.value.filter((tunnel) => {
    const haystack = [
      tunnel.name,
      tunnel.type,
      tunnel.remark,
      tunnel.custom_domain,
      tunnel.local_ip,
      String(tunnel.local_port),
      String(tunnel.remote_port),
      String(tunnel.id),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
});
const isRunnerRunning = computed(() => runnerStatus.value.running);
const isWebProtocol = computed(() => ["http", "https"].includes(createForm.type));
const availableNodes = computed(() => nodes.value.filter((node) => {
  const protocols = node.supported_protocols ?? [];
  return protocols.length === 0 || protocols.some(
    (protocol) => protocol.toLowerCase() === createForm.type,
  );
}));
const isNodeOnline = (node: NodeItem) => ["online", "active"].includes(node.status.toLowerCase());
const selectedNode = computed(() => nodes.value.find((node) => node.id === createForm.node_id));
const isDetailWebProtocol = computed(() => ["http", "https"].includes(detailForm.config.protocol));
const hasOpenModal = computed(() => detailModalVisible.value || createModalVisible.value || logModalVisible.value || deleteModalVisible.value);

watch(hasOpenModal, (visible) => {
  document.querySelector<HTMLElement>(".app-content-scroll")?.classList.toggle("is-modal-open", visible);
});

const toggleActionMenu = (menuKey: string) => {
  actionMenuKey.value = actionMenuKey.value === menuKey ? "" : menuKey;
};

const closeActionMenu = () => {
  actionMenuKey.value = "";
};

const handleActionMenuVisibleChange = (menuKey: string, visible: boolean) => {
  if (visible) {
    actionMenuKey.value = menuKey;
  } else if (actionMenuKey.value === menuKey) {
    actionMenuKey.value = "";
  }
};

const resetCreateForm = () => {
  Object.assign(createForm, {
    node_id: 0,
    type: "tcp",
    local_ip: "",
    local_port: null,
    remote_port: null,
    custom_domain: "",
    remark: "",
  });
  createError.value = "";
};

const selectFirstAvailableNode = () => {
  if (!availableNodes.value.some((node) => node.id === createForm.node_id && isNodeOnline(node))) {
    createForm.node_id = availableNodes.value.find(isNodeOnline)?.id ?? 0;
  }
};

const selectNode = (node: NodeItem) => {
  if (isNodeOnline(node)) {
    createForm.node_id = node.id;
    createError.value = "";
  }
};

const formatNodeLoad = (load: number) => {
  if (!Number.isFinite(load)) return "未知";
  return `${Math.max(0, load).toFixed(1)}%`;
};

const handleProtocolChange = (event: Event) => {
  createForm.type = (event.target as HTMLSelectElement).value;
  if (isWebProtocol.value) {
    createForm.remote_port = null;
  } else {
    createForm.custom_domain = "";
  }
  selectFirstAvailableNode();
};

const openCreateModal = async () => {
  resetCreateForm();
  createModalVisible.value = true;
  if (nodes.value.length > 0) {
    selectFirstAvailableNode();
    return;
  }

  loadingNodes.value = true;
  try {
    const response = await getNodes();
    nodes.value = response.nodes ?? [];
    selectFirstAvailableNode();
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "加载节点失败，请稍后重试";
    notificationStore.error(createError.value);
  } finally {
    loadingNodes.value = false;
  }
};

const closeCreateModal = () => {
  if (!creatingTunnel.value) {
    createModalVisible.value = false;
  }
};

const validateCreateForm = () => {
  if (createForm.node_id <= 0) return "请选择可用节点";
  if (!createForm.remark.trim()) return "请填写隧道备注";
  if (!createForm.local_ip.trim()) return "请填写本地 IP";
  if (createForm.local_port === null || !Number.isInteger(createForm.local_port) || createForm.local_port < 1 || createForm.local_port > 65535) {
    return "本地端口必须是 1 到 65535 之间的整数";
  }
  if (!isWebProtocol.value && createForm.remote_port !== null && (!Number.isInteger(createForm.remote_port) || createForm.remote_port < 1 || createForm.remote_port > 65535)) {
    return "远程端口必须是 1 到 65535 之间的整数";
  }
  if (isWebProtocol.value && !createForm.custom_domain.trim()) return "请填写自定义域名";
  return "";
};

const handleCreateTunnel = async () => {
  createError.value = validateCreateForm();
  if (createError.value) {
    notificationStore.error(createError.value);
    return;
  }

  notificationStore.dismiss();
  creatingTunnel.value = true;
  try {
    await createTunnel({
      ...createForm,
      local_ip: createForm.local_ip.trim(),
      local_port: createForm.local_port!,
      custom_domain: isWebProtocol.value ? createForm.custom_domain.trim() : "",
      remark: createForm.remark.trim(),
      remote_port: isWebProtocol.value ? 0 : (createForm.remote_port ?? 0),
    });
    createModalVisible.value = false;
    notificationStore.success("隧道创建成功");
    await loadTunnels(false);
  } catch (error) {
    createError.value = error instanceof Error ? error.message : "创建隧道失败，请稍后重试";
    notificationStore.error(createError.value);
  } finally {
    creatingTunnel.value = false;
  }
};

const loadTunnels = async (notifyError = true) => {
  await withGlobalLoading(async () => {
    try {
      const response = await getTunnelsOverview(1, 100, 2);
      tunnels.value = response.list ?? [];
    } catch (error) {
      if (notifyError) {
        notificationStore.error(error instanceof Error ? error.message : "加载隧道列表失败，请稍后重试");
      }
    }

    try {
      runnerStatus.value = await getRunnerRuntimeStatus();
    } catch (error) {
      if (notifyError) {
        notificationStore.error(error instanceof Error ? error.message : "加载运行状态失败，请稍后重试");
      }
    }
  });
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(2)} ${units[index]}`;
};

const getStatusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return "green";
  }
  if (normalized === "inactive") {
    return "grey";
  }
  return "blue";
};

const getStatusText = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return "运行中";
  }
  if (normalized === "inactive") {
    return "已停止";
  }
  return status || "未知";
};

const getTunnelTarget = (tunnel: TunnelOverviewItem) => {
  const customDomain = (tunnel.custom_domain || "").trim();
  if (customDomain) {
    return customDomain;
  }

  const nodeAddress = (tunnel.node_address || "").trim();
  if (nodeAddress) {
    return `${nodeAddress}:${tunnel.remote_port}`;
  }

  if (tunnel.remote_port > 0) {
    return `端口 ${tunnel.remote_port}`;
  }

  return "-";
};

const fillDetailForm = (detail: TunnelDetailData) => {
  Object.assign(detailForm, {
    local_ip: detail.local_ip,
    local_port: detail.local_port,
    custom_domain: detail.custom_domain || "",
    remark: detail.remark,
    config: {
      auto_tls: detail.auto_tls,
      proxy_protocol_version: "",
      protocol: detail.type.toLowerCase(),
    },
  });
};

const openTunnelDetail = async (name: string) => {
  const tunnelName = name.trim();
  if (!tunnelName) return;

  detailModalVisible.value = true;
  detailLoading.value = true;
  detailError.value = "";
  detailTab.value = "overview";
  tunnelDetail.value = null;
  try {
    const detail = await getTunnelDetail(tunnelName);
    tunnelDetail.value = detail;
    fillDetailForm(detail);
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : "加载隧道详情失败";
  } finally {
    detailLoading.value = false;
  }
};

const closeDetailModal = () => {
  if (!detailSaving.value) detailModalVisible.value = false;
};

const copyText = async (value: string, label: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    notificationStore.success(`${label}已复制`);
  } catch {
    notificationStore.error("复制失败，请手动选择文本");
  }
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN", { hour12: false });
};

const validateDetailForm = () => {
  if (!detailForm.remark.trim()) return "请填写隧道备注";
  if (!detailForm.local_ip.trim()) return "请填写本地 IP";
  if (!Number.isInteger(detailForm.local_port) || detailForm.local_port < 1 || detailForm.local_port > 65535) {
    return "本地端口必须是 1 到 65535 之间的整数";
  }
  if (isDetailWebProtocol.value && !detailForm.custom_domain.trim()) return "请填写自定义域名";
  return "";
};

const handleUpdateTunnel = async () => {
  if (!tunnelDetail.value) return;
  detailError.value = validateDetailForm();
  if (detailError.value) {
    notificationStore.error(detailError.value);
    return;
  }

  detailSaving.value = true;
  try {
    await updateTunnel(tunnelDetail.value.name, {
      local_ip: detailForm.local_ip.trim(),
      local_port: detailForm.local_port,
      custom_domain: isDetailWebProtocol.value ? detailForm.custom_domain.trim() : "",
      remark: detailForm.remark.trim(),
      config: { ...detailForm.config },
    });
    await loadTunnels();
    detailModalVisible.value = false;
    notificationStore.success("隧道设置已保存");
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : "保存隧道设置失败";
    notificationStore.error(detailError.value);
  } finally {
    detailSaving.value = false;
  }
};

const isStartedTunnel = (tunnelName: string) => {
  const normalizedName = tunnelName.trim();
  const isRunningLocally = isRunnerRunning.value &&
    ((runnerStatus.value.tunnel_names ?? []).some(
      (currentTunnelName) => currentTunnelName.trim() === normalizedName,
    ) ||
      (runnerStatus.value.tunnel_name || "").trim() === normalizedName);
  const tunnelStatus = tunnels.value.find(
    (tunnel) => tunnel.name.trim() === normalizedName,
  )?.status ?? (tunnelDetail.value?.name.trim() === normalizedName ? tunnelDetail.value.status : "");

  return isRunningLocally || tunnelStatus.toLowerCase() === "active";
};

const handleStartTunnel = async (tunnelName: string) => {
  startingTunnelName.value = tunnelName;
  try {
    runnerStatus.value = await startRunner([tunnelName]);
    await loadTunnels();
    notificationStore.success("隧道已启动");
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "启动隧道失败，请稍后重试");
  } finally {
    startingTunnelName.value = "";
  }
};

const handleStopTunnel = async (tunnelName: string) => {
  closeActionMenu();
  startingTunnelName.value = tunnelName;
  try {
    await stopTunnelRunner(tunnelName);
    runnerStatus.value = await getRunnerRuntimeStatus();
    await loadTunnels();
    notificationStore.success("隧道已停止");
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "停止隧道失败，请稍后重试");
  } finally {
    startingTunnelName.value = "";
  }
};

const handleToggleTunnel = async (tunnelName: string) => {
  if (isStartedTunnel(tunnelName)) {
    await handleStopTunnel(tunnelName);
  } else {
    await handleStartTunnel(tunnelName);
  }
};

const handleRestartTunnel = async (tunnelName: string) => {
  closeActionMenu();
  startingTunnelName.value = tunnelName;
  try {
    await stopTunnelRunner(tunnelName);
    runnerStatus.value = await startRunner([tunnelName]);
    await loadTunnels();
    notificationStore.success("隧道已重启");
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "重启隧道失败，请稍后重试");
  } finally {
    startingTunnelName.value = "";
  }
};

const clearLogRefreshTimer = () => {
  if (logRefreshTimer) {
    clearInterval(logRefreshTimer);
    logRefreshTimer = null;
  }
};

const refreshTunnelLog = async () => {
  if (!logTunnelName.value) return;

  try {
    logStatus.value = await getTunnelRunnerRuntimeStatus(logTunnelName.value);
    logError.value = "";
  } catch (error) {
    logError.value = error instanceof Error ? error.message : "获取运行日志失败";
  } finally {
    logLoading.value = false;
  }
};

const openTunnelLog = async (tunnel: TunnelOverviewItem) => {
  closeActionMenu();
  clearLogRefreshTimer();
  logTunnelName.value = tunnel.name;
  logTunnelRemark.value = tunnel.remark || tunnel.name;
  logStatus.value = null;
  logError.value = "";
  logLoading.value = true;
  logModalVisible.value = true;
  await refreshTunnelLog();
  logRefreshTimer = setInterval(() => void refreshTunnelLog(), 2000);
};

const closeTunnelLog = () => {
  logModalVisible.value = false;
  clearLogRefreshTimer();
};

const openDeleteTunnel = (tunnel: TunnelOverviewItem) => {
  closeActionMenu();
  tunnelPendingDelete.value = tunnel;
  deleteModalVisible.value = true;
};

const closeDeleteModal = () => {
  if (!deletingTunnel.value) {
    deleteModalVisible.value = false;
    tunnelPendingDelete.value = null;
  }
};

const handleDeleteTunnel = async () => {
  const tunnel = tunnelPendingDelete.value;
  if (!tunnel) return;

  deletingTunnel.value = true;
  try {
    await deleteTunnel(tunnel.name);
    tunnels.value = tunnels.value.filter((item) => item.name !== tunnel.name);
    if (tunnelDetail.value?.name === tunnel.name) {
      detailModalVisible.value = false;
      tunnelDetail.value = null;
    }
    if (logTunnelName.value === tunnel.name) {
      closeTunnelLog();
    }
    deleteModalVisible.value = false;
    tunnelPendingDelete.value = null;
    notificationStore.success("隧道已删除");
    await loadTunnels(false);
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "删除隧道失败，请稍后重试");
  } finally {
    deletingTunnel.value = false;
  }
};

const getTunnelActionMenu = (tunnel: TunnelOverviewItem): DropDownMenuItem[] => [
  {
    node: "item",
    className: isStartedTunnel(tunnel.name) ? "tunnel-restart-action" : "mobile-tunnel-action",
    name: isStartedTunnel(tunnel.name) ? "重启" : "启动",
    icon: h(isStartedTunnel(tunnel.name) ? IconRestart : IconPlay),
    onClick: () => void (isStartedTunnel(tunnel.name) ? handleRestartTunnel(tunnel.name) : handleStartTunnel(tunnel.name)),
  },
  ...(isStartedTunnel(tunnel.name) ? [{
    node: "item" as const,
    className: "mobile-tunnel-action",
    name: "停止",
    icon: h(IconPower),
    onClick: () => void handleStopTunnel(tunnel.name),
  }] : []),
  { node: "item", name: "详情", icon: h(IconInfoCircle), onClick: () => { closeActionMenu(); void openTunnelDetail(tunnel.name); } },
  { node: "item", name: "运行日志", icon: h(IconFile), onClick: () => void openTunnelLog(tunnel) },
  { node: "item", className: "delete-tunnel-action", name: "删除", icon: h(IconTrash), onClick: () => openDeleteTunnel(tunnel) },
];

onMounted(() => {
  void loadTunnels();
});

onBeforeUnmount(() => {
  clearLogRefreshTimer();
  document.querySelector<HTMLElement>(".app-content-scroll")?.classList.remove("is-modal-open");
});

</script>

<template>
  <div class="tunnels-page">
    <header class="page-heading">
      <div>
        <h1>隧道</h1>
        <p>管理本地服务与公网节点之间的转发连接</p>
      </div>
      <div class="tunnel-toolbar">
        <Input
          :value="searchQuery"
          placeholder="搜索隧道"
          show-clear
          @change="(value) => searchQuery = String(value)"
        >
          <template #prefix><IconSearch style="font-size: 17px" /></template>
        </Input>
        <div class="toolbar-actions">
          <Button theme="light" type="tertiary" @click="loadTunnels">
            <IconRefresh style="font-size: 17px" />
            刷新
          </Button>
          <Button theme="solid" type="primary" @click="openCreateModal">
            <IconPlus style="font-size: 17px" />
            新增
          </Button>
        </div>
      </div>
    </header>

    <div v-if="filteredTunnels.length" class="tunnel-list">
      <article
        v-for="tunnel in filteredTunnels"
        :key="tunnel.id"
        class="tunnel-row"
        tabindex="0"
        role="button"
        @click="openTunnelDetail(tunnel.name)"
        @keydown.enter="openTunnelDetail(tunnel.name)"
      >
        <div class="protocol-mark" :class="`protocol-${tunnel.type.toLowerCase()}`">
          <AppLogo :size="23" />
          <span>{{ tunnel.type.toUpperCase() }}</span>
        </div>

        <div class="tunnel-primary">
          <div class="tunnel-name-line">
            <strong :title="tunnel.remark">{{ tunnel.remark || tunnel.name }}</strong>
            <Tag :color="getStatusColor(tunnel.status)" type="light" size="small">
              {{ getStatusText(tunnel.status) }}
            </Tag>
          </div>
          <span class="tunnel-identity">{{ tunnel.name }}</span>
        </div>

        <div class="row-field row-node">
          <span>节点</span>
          <strong><IconServer style="font-size: 14px" />{{ tunnel.node_name || `#${tunnel.node_id}` }}</strong>
        </div>

        <div class="row-field row-address">
          <span>本地服务</span>
          <code>{{ tunnel.local_ip }}:{{ tunnel.local_port }}</code>
        </div>

        <div class="row-field row-address">
          <span>公网地址</span>
          <code :title="getTunnelTarget(tunnel)">{{ getTunnelTarget(tunnel) }}</code>
        </div>

        <div class="traffic-meta">
          <span><IconArrowDown style="font-size: 13px" />{{ formatBytes(Number(tunnel.total_in ?? 0)) }}</span>
          <span><IconArrowUp style="font-size: 13px" />{{ formatBytes(Number(tunnel.total_out ?? 0)) }}</span>
        </div>

        <div class="tunnel-actions" @click.stop>
          <Button
            class="tunnel-toggle-button"
            :class="isStartedTunnel(tunnel.name) ? 'is-stop' : 'is-start'"
            theme="light"
            :type="isStartedTunnel(tunnel.name) ? 'tertiary' : 'primary'"
            size="small"
            :loading="startingTunnelName === tunnel.name"
            :disabled="!!startingTunnelName"
            :aria-label="isStartedTunnel(tunnel.name) ? '停止隧道' : '启动隧道'"
            :title="isStartedTunnel(tunnel.name) ? '停止隧道' : '启动隧道'"
            @click="handleToggleTunnel(tunnel.name)"
          >
            <IconPower v-if="isStartedTunnel(tunnel.name)" style="font-size: 17px" />
            <IconPlay v-else style="font-size: 17px" />
          </Button>
          <Dropdown
            trigger="hover"
            position="bottomRight"
            :visible="actionMenuKey === `list:${tunnel.name}`"
            :menu="getTunnelActionMenu(tunnel)"
            :mouse-enter-delay="0"
            :mouse-leave-delay="120"
            content-class-name="tunnel-action-popup"
            @visible-change="handleActionMenuVisibleChange(`list:${tunnel.name}`, $event)"
          >
            <Button
              class="more-action-button"
              theme="borderless"
              type="tertiary"
              size="small"
              aria-label="隧道操作"
              @click.stop="toggleActionMenu(`list:${tunnel.name}`)"
            >
              <IconMore style="font-size: 18px" />
            </Button>
          </Dropdown>
        </div>
      </article>
      <footer class="list-summary">共 {{ filteredTunnels.length }} 个隧道</footer>
    </div>

    <div v-else class="empty-card">
      <Empty title="暂无可展示的隧道" description="请刷新列表或调整搜索条件">
        <template #footer>
          <Button theme="light" type="primary" @click="loadTunnels">
            <IconRefresh style="font-size: 16px" />重新加载
          </Button>
        </template>
      </Empty>
    </div>

    <Modal
      :visible="detailModalVisible"
      :footer="null"
      centered
      :mask-closable="!detailSaving"
      title="隧道详情"
      :width="900"
      :body-style="{ padding: '0' }"
      @cancel="closeDetailModal"
    >
      <div class="detail-modal">
        <div v-if="detailLoading" class="detail-state">正在加载隧道详情...</div>
        <template v-else-if="tunnelDetail">
          <section class="detail-summary">
            <div class="detail-logo" :class="`protocol-${tunnelDetail.type.toLowerCase()}`">
              <AppLogo :size="28" />
            </div>
            <div class="detail-title">
              <span class="detail-eyebrow">{{ tunnelDetail.type.toUpperCase() }} 隧道</span>
              <h2>{{ tunnelDetail.remark || tunnelDetail.name }}</h2>
              <code>{{ tunnelDetail.name }}</code>
            </div>
            <Tag :color="getStatusColor(tunnelDetail.status)" type="light" size="large">
              {{ getStatusText(tunnelDetail.status) }}
            </Tag>
            <div class="detail-actions" @click.stop>
              <Button
                class="tunnel-toggle-button"
                :class="isStartedTunnel(tunnelDetail.name) ? 'is-stop' : 'is-start'"
                theme="light"
                :type="isStartedTunnel(tunnelDetail.name) ? 'tertiary' : 'primary'"
                :loading="startingTunnelName === tunnelDetail.name"
                :disabled="!!startingTunnelName"
                :aria-label="isStartedTunnel(tunnelDetail.name) ? '停止隧道' : '启动隧道'"
                :title="isStartedTunnel(tunnelDetail.name) ? '停止隧道' : '启动隧道'"
                @click="handleToggleTunnel(tunnelDetail.name)"
              >
                <IconPower v-if="isStartedTunnel(tunnelDetail.name)" style="font-size: 17px" />
                <IconPlay v-else style="font-size: 17px" />
              </Button>
              <Dropdown
                trigger="hover"
                position="bottomRight"
                :visible="actionMenuKey === `detail:${tunnelDetail.name}`"
                :menu="getTunnelActionMenu(tunnelDetail)"
                :mouse-enter-delay="0"
                :mouse-leave-delay="120"
                content-class-name="tunnel-action-popup"
                @visible-change="handleActionMenuVisibleChange(`detail:${tunnelDetail.name}`, $event)"
              >
                <Button
                  class="more-action-button"
                  theme="borderless"
                  type="tertiary"
                  aria-label="隧道操作"
                  @click.stop="toggleActionMenu(`detail:${tunnelDetail.name}`)"
                >
                  <IconMore style="font-size: 19px" />
                </Button>
              </Dropdown>
            </div>
          </section>

          <nav class="detail-tabs" aria-label="隧道详情视图">
            <button :class="{ active: detailTab === 'overview' }" @click="detailTab = 'overview'">信息概览</button>
            <button :class="{ active: detailTab === 'settings' }" @click="detailTab = 'settings'">设置</button>
          </nav>

          <div v-if="detailTab === 'overview'" class="detail-content">
            <section class="detail-section">
              <h3>连接信息</h3>
              <div class="detail-table">
                <div><span>本地服务</span><code>{{ tunnelDetail.local_ip }}:{{ tunnelDetail.local_port }}</code><button aria-label="复制本地服务地址" @click="copyText(`${tunnelDetail.local_ip}:${tunnelDetail.local_port}`, '本地服务地址')"><IconCopy /></button></div>
                <div><span>公网地址</span><code>{{ getTunnelTarget(tunnelDetail) }}</code><button aria-label="复制公网地址" @click="copyText(getTunnelTarget(tunnelDetail), '公网地址')"><IconCopy /></button></div>
                <div><span>节点</span><strong>{{ tunnelDetail.node_name || `#${tunnelDetail.node_id}` }}</strong></div>
                <div><span>节点地址</span><code>{{ tunnelDetail.node_address || '-' }}</code></div>
              </div>
            </section>

            <section class="detail-section">
              <h3>隧道配置</h3>
              <div class="detail-table">
                <div><span>协议</span><strong>{{ tunnelDetail.type.toUpperCase() }}</strong></div>
                <div><span>远程端口</span><strong>{{ tunnelDetail.remote_port || '-' }}</strong></div>
                <div><span>自定义域名</span><code>{{ tunnelDetail.custom_domain || '-' }}</code></div>
                <div><span>自动 TLS</span><strong>{{ tunnelDetail.auto_tls ? '已开启' : '未开启' }}</strong></div>
                <div><span>带宽限制</span><strong>{{ tunnelDetail.bandwidth_limit ? `${tunnelDetail.bandwidth_limit} Mbps` : '无限制' }}</strong></div>
                <div><span>客户端版本</span><strong>{{ tunnelDetail.client_version || '-' }}</strong></div>
              </div>
            </section>

            <section class="detail-section">
              <h3>基础信息</h3>
              <div class="detail-table">
                <div><span>隧道 ID</span><strong>{{ tunnelDetail.id }}</strong></div>
                <div><span>节点 ID</span><strong>{{ tunnelDetail.node_id }}</strong></div>
                <div><span>创建时间</span><strong>{{ formatDateTime(tunnelDetail.created_at) }}</strong></div>
                <div><span>隧道令牌</span><code class="secret-value">{{ tunnelDetail.tunnel_token || '-' }}</code><button aria-label="复制隧道令牌" @click="copyText(tunnelDetail.tunnel_token, '隧道令牌')"><IconCopy /></button></div>
              </div>
            </section>
          </div>

          <form v-else class="detail-settings" @submit.prevent="handleUpdateTunnel">
            <div class="detail-settings-content">
              <section class="detail-section">
              <div class="settings-heading">
                <div><h3>基本设置</h3><p>修改隧道备注和本地服务连接。</p></div>
                <IconEdit style="font-size: 18px" />
              </div>
              <div class="form-grid">
                <label class="field field-wide"><span>隧道备注</span><input v-model="detailForm.remark" type="text" maxlength="64" /></label>
                <label class="field"><span>本地 IP</span><input v-model="detailForm.local_ip" type="text" /></label>
                <label class="field"><span>本地端口</span><input v-model.number="detailForm.local_port" type="number" min="1" max="65535" /></label>
              </div>
              </section>
              <section class="detail-section">
              <h3>协议设置</h3>
              <div class="form-grid">
                <label class="field"><span>协议类型</span><select v-model="detailForm.config.protocol"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="http">HTTP</option><option value="https">HTTPS</option></select></label>
                <label class="field"><span>Proxy Protocol</span><select v-model="detailForm.config.proxy_protocol_version"><option value="">关闭</option><option value="v1">V1</option><option value="v2">V2</option></select></label>
                <label v-if="isDetailWebProtocol" class="field field-wide"><span>自定义域名</span><input v-model="detailForm.custom_domain" type="text" placeholder="service.example.com" /></label>
                <label class="toggle-field field-wide"><input v-model="detailForm.config.auto_tls" type="checkbox" /><span><strong>自动 TLS</strong><small>为 HTTP/HTTPS 隧道自动配置 TLS。</small></span></label>
              </div>
              </section>
            </div>
            <footer class="detail-savebar">
              <Button theme="light" type="tertiary" :disabled="detailSaving" @click="detailTab = 'overview'">取消</Button>
              <Button html-type="submit" theme="solid" type="primary" :loading="detailSaving"><IconSave style="font-size: 15px" />保存更改</Button>
            </footer>
          </form>
        </template>
        <div v-else class="detail-state error-state">{{ detailError || "无法加载隧道详情" }}</div>
      </div>
    </Modal>

    <Modal
      :visible="createModalVisible"
      :footer="null"
      centered
      :mask-closable="!creatingTunnel"
      title="创建隧道"
      :width="720"
      :body-style="{ padding: '0', overflow: 'hidden' }"
      @cancel="closeCreateModal"
    >
      <form class="create-form" @submit.prevent="handleCreateTunnel">
        <div class="create-form-content">
          <p class="modal-description">将本地服务安全地映射到 Lolia FRP 节点</p>

          <section class="form-section">
            <div class="section-heading">
              <span>01</span>
              <div><h3>基本设置</h3><p>选择协议并为隧道设置易识别的备注。</p></div>
            </div>
            <div class="form-grid">
              <label class="field field-wide">
                <span>隧道名称</span>
                <input v-model="createForm.remark" type="text" maxlength="64" placeholder="例如：MC 服务器" />
              </label>
              <label class="field">
                <span>协议类型</span>
                <select :value="createForm.type" @change="handleProtocolChange">
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <span>02</span>
              <div><h3>选择节点</h3><p>仅显示支持 {{ createForm.type.toUpperCase() }} 协议的节点，离线节点不可选择。</p></div>
            </div>
            <div v-if="loadingNodes" class="node-list-state">正在获取节点列表...</div>
            <div v-else-if="availableNodes.length" class="node-list" role="radiogroup" aria-label="转发节点">
              <button
                v-for="node in availableNodes"
                :key="node.id"
                type="button"
                class="node-option"
                :class="{ selected: node.id === createForm.node_id, offline: !isNodeOnline(node) }"
                :disabled="!isNodeOnline(node)"
                role="radio"
                :aria-checked="node.id === createForm.node_id"
                @click="selectNode(node)"
              >
                <span class="node-option-main">
                  <span class="node-name-row">
                    <strong>{{ node.name }}</strong>
                    <Tag :color="isNodeOnline(node) ? 'green' : 'grey'" type="light" size="small">
                      {{ isNodeOnline(node) ? "在线" : "离线" }}
                    </Tag>
                    <IconCheckCircleStroked v-if="node.id === createForm.node_id" class="node-check" style="font-size: 18px" />
                  </span>
                  <span v-if="node.remark" class="node-remark">{{ node.remark }}</span>
                  <span class="node-meta">
                    <span><IconMapPin style="font-size: 13px" />{{ node.region_code || "未知地区" }}</span>
                    <span><IconGlobe style="font-size: 13px" />{{ node.bandwidth || 0 }} Mbps</span>
                    <span>负载 {{ formatNodeLoad(node.load) }}</span>
                  </span>
                  <span class="node-protocols">
                    <Tag v-for="protocol in node.supported_protocols" :key="protocol" color="blue" type="light" size="small">
                      {{ protocol.toUpperCase() }}
                    </Tag>
                    <Tag v-if="node.need_kyc" color="orange" type="light" size="small">需实名</Tag>
                    <Tag v-if="node.beian_required" color="violet" type="light" size="small">需备案</Tag>
                  </span>
                </span>
              </button>
            </div>
            <div v-else class="node-list-state">暂无支持该协议的节点</div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <span>03</span>
              <div><h3>本地服务</h3><p>填写需要被访问的本地监听地址。</p></div>
            </div>
            <div class="form-grid">
              <label class="field">
                <span>本地 IP</span>
                <input v-model="createForm.local_ip" type="text" placeholder="例如：127.0.0.1" />
              </label>
              <label class="field">
                <span>本地端口</span>
                <input v-model.number="createForm.local_port" type="number" min="1" max="65535" placeholder="例如：8080" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <span>04</span>
              <div><h3>公网访问</h3><p>{{ isWebProtocol ? "绑定用于访问服务的完整域名。" : "指定节点对外开放的访问端口。" }}</p></div>
            </div>
            <div class="form-grid single-field">
              <label v-if="isWebProtocol" class="field field-wide">
                <span>自定义域名</span>
                <input v-model="createForm.custom_domain" type="text" placeholder="service.example.com" />
              </label>
              <label v-else class="field">
                <span>远程端口</span>
                <input v-model.number="createForm.remote_port" type="number" min="1" max="65535" placeholder="留空自动分配" />
              </label>
            </div>
          </section>
        </div>

        <div class="modal-actions">
          <Button theme="light" type="tertiary" size="large" :disabled="creatingTunnel" @click="closeCreateModal">取消</Button>
          <Button html-type="submit" theme="solid" type="primary" size="large" :loading="creatingTunnel" :disabled="loadingNodes || !selectedNode">
            <IconPlus style="font-size: 17px" />创建隧道
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      :visible="logModalVisible"
      :footer="null"
      centered
      :mask-closable="true"
      :title="`${logTunnelRemark} · 运行日志`"
      :width="760"
      :body-style="{ padding: '0' }"
      @cancel="closeTunnelLog"
    >
      <div class="tunnel-log-modal">
        <div class="tunnel-log-meta">
          <span>{{ logTunnelName }}</span>
          <Tag :color="logStatus?.running ? 'green' : 'grey'" type="light">
            {{ logStatus?.running ? "运行中" : "未运行" }}
          </Tag>
        </div>
        <div v-if="logLoading" class="tunnel-log-state">正在读取运行日志...</div>
        <Banner v-else-if="logError" type="danger" :description="logError" />
        <pre v-else class="tunnel-log-output">{{ logStatus?.log_lines?.join("\n") || "暂无运行日志" }}</pre>
      </div>
    </Modal>

    <Modal
      :visible="deleteModalVisible"
      :footer="null"
      centered
      :mask-closable="!deletingTunnel"
      :closable="false"
      :width="520"
      :body-style="{ padding: '0' }"
      @cancel="closeDeleteModal"
    >
      <div class="delete-confirmation">
        <header class="delete-confirmation-heading">
          <NotificationStatusIcon type="error" />
          <h3>删除{{ tunnelPendingDelete?.remark || tunnelPendingDelete?.name }}</h3>
        </header>
        <p>隧道将被删除。删除后，该隧道的配置将无法恢复。是否确定继续？</p>
        <footer class="delete-confirmation-actions">
          <Button theme="light" type="tertiary" :disabled="deletingTunnel" @click="closeDeleteModal">取消</Button>
          <Button theme="solid" type="danger" :loading="deletingTunnel" @click="handleDeleteTunnel"><IconTrash />删除隧道</Button>
        </footer>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.tunnels-page { display: flex; flex-direction: column; gap: 18px; }
.page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 4px 0 10px; }
.page-heading h1, .page-heading p { margin: 0; }
.page-heading h1 { color: var(--app-text-strong); font-size: 26px; line-height: 1.2; }
.page-heading p { margin-top: 6px; color: var(--app-text); font-size: 13px; }
.tunnel-toolbar { display: grid; grid-template-columns: minmax(180px, 260px) auto; align-items: center; gap: 10px; }
.toolbar-actions { display: flex; align-items: center; gap: 10px; }
.tunnel-toolbar :deep(.semi-input-wrapper), .tunnel-toolbar :deep(.semi-button) { border-radius: var(--app-radius-control); }
.tunnel-toolbar :deep(.semi-button-content), .tunnel-actions :deep(.semi-button-content),
.traffic-meta span, .modal-actions :deep(.semi-button-content), .detail-actions :deep(.semi-button-content),
.detail-savebar :deep(.semi-button-content), .row-node strong { display: flex; align-items: center; gap: 6px; }
.tunnel-list { display: flex; flex-direction: column; gap: 14px; }
.tunnel-row { display: grid; min-height: 82px; grid-template-columns: 66px minmax(150px, 1.15fr) minmax(110px, .8fr) minmax(130px, .9fr) minmax(130px, .9fr) 118px auto; align-items: center; gap: 16px; box-sizing: border-box; padding: 12px 16px; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); outline: none; background: var(--app-surface-muted); cursor: pointer; transition: border-color .16s; }
.tunnel-row:hover { background: var(--app-surface-muted); }
.tunnel-row:focus-visible { border-color: color-mix(in srgb, var(--app-text) 45%, var(--app-border)); }
.protocol-mark { display: grid; width: 52px; height: 52px; grid-template-rows: 1fr auto; place-items: center; border-radius: var(--app-radius-control); background: color-mix(in srgb, var(--app-accent) 10%, transparent); color: var(--app-accent); }
.protocol-mark span { padding-bottom: 5px; font-size: 9px; font-weight: 800; line-height: 1; }
.protocol-udp { background: rgba(10, 158, 121, .11); color: #0a9e79; }
.protocol-http, .protocol-https { background: rgba(230, 126, 34, .12); color: #c76816; }
.tunnel-primary { display: flex; min-width: 0; flex-direction: column; gap: 6px; }
.tunnel-name-line { display: flex; min-width: 0; align-items: center; gap: 8px; }
.tunnel-name-line strong { overflow: hidden; color: var(--app-text-strong); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.tunnel-identity { overflow: hidden; color: var(--app-text); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.row-field { display: flex; min-width: 0; flex-direction: column; gap: 7px; }
.row-field > span { color: var(--app-text); font-size: 11px; }
.row-field strong, .row-field code { overflow: hidden; color: var(--app-text-strong); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.row-node strong { min-width: 0; }
.traffic-meta, .tunnel-actions { display: flex; align-items: center; gap: 8px; }
.traffic-meta { flex-direction: column; align-items: flex-start; gap: 7px; color: var(--app-text); font-size: 11px; }
.traffic-meta span:first-child { color: #168f63; }
.traffic-meta span:last-child { color: #2764e7; }
.tunnel-actions { justify-content: flex-end; gap: 12px; }
.tunnel-toggle-button { width: 38px; height: 38px; padding: 0; border: 1px solid transparent; border-radius: var(--app-radius-control); background: transparent; color: var(--app-text); }
.tunnel-toggle-button.is-start:hover:not(:disabled), .tunnel-toggle-button.is-start:focus-visible:not(:disabled) { border-color: color-mix(in srgb, var(--app-accent) 28%, transparent); background: color-mix(in srgb, var(--app-accent) 12%, var(--app-surface)); color: var(--app-accent); }
.tunnel-toggle-button.is-start:active:not(:disabled) { border-color: var(--app-accent); background: transparent; color: var(--app-accent); }
.tunnel-toggle-button.is-stop:hover:not(:disabled), .tunnel-toggle-button.is-stop:focus-visible:not(:disabled) { border-color: color-mix(in srgb, #e5484d 28%, transparent); background: color-mix(in srgb, #e5484d 12%, var(--app-surface)); color: #d9363e; }
.tunnel-toggle-button.is-stop:active:not(:disabled) { border-color: #e5484d; background: transparent; color: #d9363e; }
.more-action-button { width: 38px; height: 38px; border-radius: var(--app-radius-control); }
.more-action-button:hover { background: color-mix(in srgb, var(--app-text-strong) 10%, var(--app-surface-muted)); }
.more-action-button:focus-visible, .more-action-button:active { background: transparent; }
.list-summary { padding: 0 2px; color: var(--app-text); font-size: 12px; text-align: right; }
.empty-card { padding: 56px 20px; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface); }
.detail-modal { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow: hidden; color: var(--app-text-strong); }
.detail-state { display: grid; min-height: 320px; place-items: center; color: var(--app-text); font-size: 13px; }
.error-state { color: #d54941; }
.detail-summary { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 16px; margin: 0 24px 18px; padding: 14px 16px; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface-muted); }
.detail-logo { display: grid; width: 52px; height: 52px; place-items: center; border-radius: var(--app-radius-control); background: color-mix(in srgb, var(--app-accent) 10%, transparent); color: var(--app-accent); }
.detail-title { min-width: 0; }
.detail-title h2 { overflow: hidden; margin: 3px 0; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.detail-title code, .detail-eyebrow { color: var(--app-text); font-size: 11px; }
.detail-eyebrow { font-weight: 700; text-transform: uppercase; }
.detail-actions { display: flex; align-items: center; gap: 7px; }
.detail-tabs { display: flex; gap: 24px; padding: 0 24px; border-bottom: 1px solid var(--app-border); }
.detail-tabs button { position: relative; padding: 12px 2px; border: 0; background: transparent; color: var(--app-text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.detail-tabs button.active { color: #1677ff; }
.detail-tabs button.active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; background: #1677ff; content: ""; }
.detail-error { margin: 16px 24px 0; }
.detail-content { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 22px; overflow-y: auto; padding: 22px 24px 26px; overscroll-behavior: contain; }
.detail-settings { display: grid; min-height: 0; flex: 1; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }
.detail-settings-content { display: flex; min-height: 0; flex-direction: column; gap: 22px; overflow-y: auto; padding: 22px 24px 26px; overscroll-behavior: contain; }
.detail-section { min-width: 0; }
.detail-section h3 { margin: 0 0 11px; color: var(--app-text-strong); font-size: 13px; }
.detail-table { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--app-border); border-left: 1px solid var(--app-border); }
.detail-table > div { display: grid; min-width: 0; min-height: 45px; grid-template-columns: 102px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 0 12px; border-right: 1px solid var(--app-border); border-bottom: 1px solid var(--app-border); background: var(--app-surface); }
.detail-table span { color: var(--app-text); font-size: 11px; }
.detail-table strong, .detail-table code { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.detail-table button { display: grid; width: 26px; height: 26px; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--app-text); cursor: pointer; }
.detail-table button:hover { background: color-mix(in srgb, var(--app-text-strong) 10%, var(--app-surface-muted)); color: #1677ff; }
.secret-value { filter: blur(3px); transition: filter .16s; }
.secret-value:hover { filter: none; }
.settings-heading { display: flex; justify-content: space-between; color: #1677ff; }
.settings-heading h3, .settings-heading p { margin: 0; }
.settings-heading p { margin-top: 4px; color: var(--app-text); font-size: 11px; }
.toggle-field { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--app-border); border-radius: var(--app-radius-control); background: var(--app-surface-muted); }
.toggle-field input { width: 16px; height: 16px; accent-color: #1677ff; }
.toggle-field span { display: flex; flex-direction: column; gap: 2px; }
.toggle-field strong { font-size: 12px; }
.toggle-field small { color: var(--app-text); font-size: 11px; }
.detail-savebar { z-index: 2; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--app-border); background: var(--app-surface); box-shadow: 0 -6px 16px rgba(20, 24, 31, .04); }
.detail-savebar :deep(.semi-button-light) { background: color-mix(in srgb, var(--app-text-strong) 10%, var(--app-surface-muted)); }
.create-form { display: grid; min-height: 0; flex: 1; grid-template-rows: minmax(0, 1fr) auto; }
.create-form-content { display: flex; min-height: 0; flex-direction: column; gap: 14px; overflow-y: auto; padding: 4px 24px 18px; overscroll-behavior: contain; }
.modal-description { margin: -2px 0 2px; color: var(--app-text); font-size: 12px; }
.form-section { padding: 18px; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface-muted); }
.section-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.section-heading > span { display: grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; border-radius: var(--app-radius-control); background: color-mix(in srgb, var(--app-accent) 12%, transparent); color: var(--app-accent); font-size: 11px; font-weight: 700; }
.section-heading h3, .section-heading p { margin: 0; }
.section-heading h3 { color: var(--app-text-strong); font-size: 14px; }
.section-heading p { margin-top: 3px; color: var(--app-text); font-size: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field { display: flex; min-width: 0; flex-direction: column; gap: 7px; color: var(--app-text-strong); font-size: 12px; font-weight: 600; }
.field-wide { grid-column: 1 / -1; }
.field input, .field select { width: 100%; height: 38px; box-sizing: border-box; padding: 0 11px; border: 1px solid var(--app-border); border-radius: 10px; outline: none; background: var(--app-surface); color: var(--app-text-strong); font: inherit; font-weight: 400; transition: border-color .16s, box-shadow .16s; }
.field input:focus, .field select:focus { border-color: #1677ff; box-shadow: 0 0 0 3px rgba(22, 119, 255, .12); }
.field select:disabled { cursor: not-allowed; opacity: .6; }
.single-field { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.node-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.node-option { min-width: 0; padding: 13px; border: 1px solid var(--app-border); border-radius: var(--app-radius-control); background: var(--app-surface); color: var(--app-text-strong); text-align: left; cursor: pointer; transition: border-color .16s, background .16s, box-shadow .16s; }
.node-option:hover:not(:disabled) { border-color: #1677ff; }
.node-option.selected { border-color: var(--app-accent); background: var(--app-surface); box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 10%, transparent); }
.node-option.offline { cursor: not-allowed; opacity: .58; }
.node-option-main { display: flex; min-width: 0; flex-direction: column; gap: 8px; }
.node-name-row, .node-meta, .node-protocols { display: flex; align-items: center; gap: 7px; }
.node-name-row strong { overflow: hidden; flex: 1; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.node-check { flex: 0 0 auto; color: #1677ff; }
.node-remark { overflow: hidden; color: var(--app-text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.node-meta { flex-wrap: wrap; color: var(--app-text); font-size: 11px; }
.node-meta span { display: flex; align-items: center; gap: 3px; }
.node-protocols { flex-wrap: wrap; }
.node-list-state { display: grid; min-height: 82px; place-items: center; border: 1px dashed var(--app-border); border-radius: 7px; color: var(--app-text); font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 24px; border-top: 1px solid var(--app-border); background: var(--app-surface); box-shadow: 0 -6px 16px rgba(20, 24, 31, .04); }
:global(.semi-modal-content:has(.create-form)) { display: flex; max-height: calc(100dvh - 48px); flex-direction: column; overflow: hidden; border-radius: var(--app-radius-panel); background: var(--app-surface); }
:global(.semi-modal-content:has(.create-form) .semi-modal-header) { margin-bottom: 16px; }
:global(.semi-modal-content:has(.create-form) .semi-modal-body) { display: flex; min-height: 0; flex: 1; overflow: hidden; }
:global(.semi-modal:has(.create-form)) { width: 720px !important; max-width: calc(100vw - 48px); margin: 24px auto !important; }
:global(.semi-modal-content:has(.detail-modal)) { display: flex; max-height: calc(100dvh - 48px); flex-direction: column; overflow: hidden; border-radius: var(--app-radius-panel); background: var(--app-surface); }
:global(.semi-modal-content:has(.detail-modal) .semi-modal-header) { margin-bottom: 14px; }
:global(.semi-modal-content:has(.detail-modal) .semi-modal-body) { display: flex; min-height: 0; flex: 1; overflow: hidden; }
:global(.semi-modal:has(.detail-modal)) { width: 900px !important; max-width: calc(100vw - 48px); margin: 24px auto !important; }
.tunnel-log-modal { display: flex; min-height: 300px; max-height: calc(100dvh - 160px); flex-direction: column; gap: 12px; padding-bottom: 24px; overflow: hidden; }
.tunnel-log-meta { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; color: var(--app-text); font-size: 12px; }
.tunnel-log-state { display: grid; min-height: 300px; place-items: center; color: var(--app-text); }
.tunnel-log-output { min-height: 300px; margin: 0 20px; padding: 18px 20px 32px; overflow: auto; border-radius: var(--app-radius-control); background: #101216; color: #d7dce2; font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
:global(.semi-modal-content:has(.tunnel-log-modal)) { overflow: hidden; border-radius: var(--app-radius-panel); background: var(--app-surface); }
:global(.semi-modal:has(.tunnel-log-modal)) { width: 760px !important; max-width: calc(100vw - 48px); margin: 24px auto !important; }
:global(.tunnel-action-popup) { padding: 6px 0 !important; border: 1px solid var(--app-border); border-radius: var(--app-radius-panel); background: var(--app-surface); box-shadow: 0 8px 24px rgba(20, 24, 31, .14); }
:global(.tunnel-action-popup .semi-dropdown-menu), :global(.tunnel-action-menu) { min-width: 138px; padding: 0; background: transparent; }
:global(.tunnel-action-popup .semi-dropdown-item), :global(.tunnel-action-menu .semi-dropdown-item) { display: flex; height: 42px; box-sizing: border-box; align-items: center; gap: 12px; margin: 0; padding: 0 14px; border-radius: 0; color: var(--app-text-strong); font-size: 14px; line-height: 42px; white-space: nowrap; }
:global(.tunnel-action-popup .semi-dropdown-item > .semi-icon), :global(.tunnel-action-menu .semi-dropdown-item > .semi-icon) { width: 17px; height: 17px; flex: 0 0 17px; font-size: 17px; }
:global(.tunnel-action-popup .semi-dropdown-item:hover), :global(.tunnel-action-menu .semi-dropdown-item:hover) { background: var(--app-surface-muted); }
:global(.tunnel-action-popup .mobile-tunnel-action) { display: none; }
:global(.semi-modal-content:has(.delete-confirmation)) { padding: 0; overflow: hidden; }
:global(.semi-modal-content:has(.delete-confirmation) .semi-modal-body-wrapper) { margin: 0; }
.delete-confirmation { padding: 28px 32px; }
.delete-confirmation-heading { display: flex; align-items: center; gap: 12px; }
.delete-confirmation h3, .delete-confirmation p { margin: 0; }
.delete-confirmation h3 { overflow: hidden; color: var(--app-text-strong); font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.delete-confirmation p { margin-top: 28px; color: var(--app-text-strong); font-size: 14px; line-height: 1.7; }
.delete-confirmation-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 28px; }
.delete-confirmation-actions :deep(.semi-button) { min-width: 108px; height: 42px; }
.delete-confirmation-actions :deep(.semi-button-content) { display: flex; align-items: center; gap: 6px; }
@media (max-width: 1180px) {
  .tunnel-row { grid-template-columns: 58px minmax(150px, 1.2fr) minmax(110px, .8fr) minmax(130px, 1fr) 110px auto; }
  .row-address:nth-of-type(5) { display: none; }
}
@media (max-width: 900px) {
  .page-heading { align-items: flex-start; flex-direction: column; }
  .tunnel-toolbar { width: 100%; grid-template-columns: minmax(0, 1fr) auto; }
  .tunnel-row { grid-template-columns: 58px minmax(140px, 1fr) minmax(120px, .8fr) 100px auto; }
  .row-node { display: none; }
}
@media (max-width: 620px) {
  .tunnel-toolbar { grid-template-columns: 1fr; }
  .toolbar-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .page-heading h1 { font-size: 23px; }
  .tunnel-row { grid-template-columns: 48px minmax(0, 1fr) auto; gap: 12px; padding: 12px; }
  .protocol-mark { width: 44px; height: 48px; }
  .row-field, .traffic-meta { display: none; }
  .list-summary { text-align: left; }
  .detail-summary { grid-template-columns: auto minmax(0, 1fr) auto; margin: 0 16px 14px; padding: 12px; }
  .detail-summary > :deep(.semi-tag) { grid-column: 2; justify-self: start; }
  .detail-actions { grid-row: 1 / span 2; grid-column: 3; }
  .detail-tabs { padding: 0 16px; }
  .detail-error { margin-right: 16px; margin-left: 16px; }
  .detail-content, .detail-settings-content { padding: 18px 16px 22px; }
  .detail-table { grid-template-columns: 1fr; }
  .detail-table > div { grid-template-columns: 86px minmax(0, 1fr) auto; }
  .detail-savebar { padding-right: 16px; padding-left: 16px; }
  :global(.semi-modal:has(.create-form)), :global(.semi-modal:has(.detail-modal)), :global(.semi-modal:has(.tunnel-log-modal)) { max-width: calc(100vw - 24px); margin: 12px auto !important; }
  :global(.semi-modal-content:has(.create-form)), :global(.semi-modal-content:has(.detail-modal)) { max-height: calc(100dvh - 24px); }
  .form-grid, .single-field { grid-template-columns: 1fr; }
  .node-list { grid-template-columns: 1fr; }
  .field-wide { grid-column: auto; }
  .form-section { padding: 14px; }
  .create-form-content { padding-right: 16px; padding-left: 16px; }
  .modal-actions { padding-right: 16px; padding-left: 16px; }
  .delete-confirmation { padding: 24px; }
  .delete-confirmation p, .delete-confirmation-actions { margin-top: 22px; }
  .delete-confirmation-actions :deep(.semi-button) { min-width: 96px; }
}
</style>
