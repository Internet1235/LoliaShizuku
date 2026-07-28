<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Banner, Button, Card, Empty, Input, Tag } from "@kousum/semi-ui-vue";
import {
  IconArrowDown,
  IconArrowUp,
  IconExternalOpen,
  IconPlay,
  IconRefresh,
  IconSearch,
  IconServer,
} from "@kousum/semi-icons-vue";
import {
  getRunnerRuntimeStatus,
  getTunnelsOverview,
  startRunner,
  type RunnerRuntimeStatus,
  type TunnelOverviewItem,
} from "@/services/center";
import { useGlobalLoadingStore } from "@/stores/globalLoading";
import { openExternalURL } from "@/services/platform";

defineOptions({
  name: "TunnelsPage",
});

const errorMessage = ref("");
const searchQuery = ref("");
const tunnels = ref<TunnelOverviewItem[]>([]);
const globalLoadingStore = useGlobalLoadingStore();
const withGlobalLoading = <T,>(task: () => Promise<T>) =>
  globalLoadingStore.withGlobalLoading(task);
const router = useRouter();
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

const loadTunnels = async () => {
  errorMessage.value = "";

  await withGlobalLoading(async () => {
    try {
      const [response, status] = await Promise.all([
        getTunnelsOverview(1, 100, 2),
        getRunnerRuntimeStatus(),
      ]);
      tunnels.value = response.list ?? [];
      runnerStatus.value = status;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "加载隧道列表失败，请稍后重试";
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

const openTunnelDetail = (name: string) => {
  const tunnelName = name.trim();
  if (!tunnelName) {
    return;
  }
  openExternalURL(
    `https://dash.lolia.link/dash/tunnel/${encodeURIComponent(tunnelName)}`,
  );
};

const isStartedTunnel = (tunnelName: string) =>
  isRunnerRunning.value &&
  ((runnerStatus.value.tunnel_names ?? []).some(
    (currentTunnelName) => currentTunnelName.trim() === tunnelName.trim(),
  ) ||
    (runnerStatus.value.tunnel_name || "").trim() === tunnelName.trim());

const handleStartTunnel = async (tunnelName: string) => {
  errorMessage.value = "";
  startingTunnelName.value = tunnelName;
  try {
    runnerStatus.value = await startRunner([tunnelName]);
    await loadTunnels();
    await router.push("/runner");
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "启动隧道失败，请稍后重试";
  } finally {
    startingTunnelName.value = "";
  }
};

onMounted(() => {
  void loadTunnels();
});
</script>

<template>
  <div class="tunnels-page">
    <Banner v-if="errorMessage" type="danger" :description="errorMessage" />

    <Card class="toolbar-card" :bordered="true">
      <div class="tunnel-toolbar">
        <Input
          :value="searchQuery"
          placeholder="搜索名称、节点、地址或端口"
          show-clear
          size="large"
          @change="(value) => searchQuery = String(value)"
        >
          <template #prefix><IconSearch style="font-size: 17px" /></template>
        </Input>
        <Button theme="light" type="primary" size="large" @click="loadTunnels">
          <IconRefresh style="font-size: 17px" />
          刷新
        </Button>
      </div>
    </Card>

    <div v-if="filteredTunnels.length" class="tunnel-grid">
      <Card
        v-for="tunnel in filteredTunnels"
        :key="tunnel.id"
        class="tunnel-card"
        :bordered="true"
        :body-style="{ padding: '0' }"
      >
        <div class="tunnel-card-body">
          <div class="tunnel-title-row">
            <h2 :title="tunnel.remark">{{ tunnel.remark }}</h2>
            <Tag :color="getStatusColor(tunnel.status)" type="light" size="small">
              {{ getStatusText(tunnel.status) }}
            </Tag>
          </div>

          <div class="tunnel-addresses">
            <div>
              <span>本地</span>
              <code>{{ tunnel.local_ip }}:{{ tunnel.local_port }}</code>
            </div>
            <div>
              <span>目标</span>
              <code :title="getTunnelTarget(tunnel)">{{ getTunnelTarget(tunnel) }}</code>
            </div>
          </div>

          <div class="tunnel-tags">
            <Tag color="blue" type="light" size="small">{{ tunnel.type.toUpperCase() }}</Tag>
            <Tag color="grey" type="light" size="small"><IconServer style="font-size: 12px" /> {{ tunnel.node_name }}</Tag>
          </div>

          <div class="traffic-meta">
            <span><IconArrowDown style="font-size: 13px" />{{ formatBytes(Number(tunnel.total_in ?? 0)) }}</span>
            <span><IconArrowUp style="font-size: 13px" />{{ formatBytes(Number(tunnel.total_out ?? 0)) }}</span>
          </div>
        </div>

        <div class="tunnel-actions">
          <Button
            theme="light"
            type="primary"
            size="small"
            :loading="startingTunnelName === tunnel.name"
            :disabled="!!startingTunnelName || isStartedTunnel(tunnel.name)"
            @click="handleStartTunnel(tunnel.name)"
          >
            <IconPlay style="font-size: 14px" />
            {{ isStartedTunnel(tunnel.name) ? "已启动" : "启动" }}
          </Button>
          <Button theme="borderless" type="tertiary" size="small" @click="openTunnelDetail(tunnel.name)">
            <IconExternalOpen style="font-size: 14px" />详情
          </Button>
        </div>
      </Card>
    </div>

    <Card v-else class="empty-card" :bordered="true">
      <Empty title="暂无可展示的隧道" description="请刷新列表或调整搜索条件">
        <template #footer>
          <Button theme="light" type="primary" @click="loadTunnels">
            <IconRefresh style="font-size: 16px" />重新加载
          </Button>
        </template>
      </Empty>
    </Card>
  </div>
</template>

<style scoped>
.tunnels-page { display: flex; flex-direction: column; gap: 18px; }
.toolbar-card, .tunnel-card, .empty-card { background: var(--app-surface); border-color: var(--app-border); }
.tunnel-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; }
.tunnel-toolbar :deep(.semi-button-content), .tunnel-actions :deep(.semi-button-content),
.tunnel-tags :deep(.semi-tag-content), .traffic-meta span { display: flex; align-items: center; gap: 6px; }
.tunnel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.tunnel-card { min-width: 0; }
.tunnel-card-body { display: flex; flex-direction: column; gap: 16px; padding: 18px; }
.tunnel-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tunnel-title-row h2 { overflow: hidden; margin: 0; color: var(--app-text-strong); font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.tunnel-addresses { display: flex; flex-direction: column; gap: 8px; }
.tunnel-addresses div { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 8px; }
.tunnel-addresses span { color: var(--app-text); font-size: 12px; }
.tunnel-addresses code { overflow: hidden; color: var(--app-text-strong); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.tunnel-tags, .traffic-meta, .tunnel-actions { display: flex; align-items: center; gap: 8px; }
.traffic-meta { gap: 18px; color: var(--app-text); font-size: 12px; }
.traffic-meta span:first-child { color: #168f63; }
.traffic-meta span:last-child { color: #2764e7; }
.tunnel-actions { justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--app-border); }
.empty-card { padding: 56px 20px; }
@media (max-width: 980px) { .tunnel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) {
  .tunnel-grid { grid-template-columns: 1fr; }
  .tunnel-toolbar { grid-template-columns: 1fr; }
}
</style>
