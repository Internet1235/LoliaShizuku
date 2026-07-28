<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Banner, Button, Card, Tag } from "@kousum/semi-ui-vue";
import { IconPlay, IconRefresh, IconStop, IconTerminal } from "@kousum/semi-icons-vue";
import {
  getRunnerData,
  getRunnerRuntimeStatus,
  getTunnelsOverview,
  startRunner,
  stopRunner,
  type RunnerRuntimeStatus,
} from "@/services/center";
import { useGlobalLoadingStore } from "@/stores/globalLoading";

defineOptions({
  name: "RunnerPage",
});

const errorMessage = ref("");
const globalLoadingStore = useGlobalLoadingStore();
const withGlobalLoading = <T>(task: () => Promise<T>) =>
  globalLoadingStore.withGlobalLoading(task);
const runningAction = ref(false);
const runtimePolling = ref(false);
let runtimePollTimer: ReturnType<typeof setInterval> | null = null;

const summary = ref({
  server: "-",
  protocol: "-",
  version: "-",
  pid: "-",
  startTime: "-",
});

const tunnels = ref<
  Array<{
    name: string;
    remark: string;
    customDomain: string;
    type: string;
    local: string;
    remote: string;
    remotePort: number;
    status: string;
    statusColor: string;
  }>
>([]);

const logs = ref<string[]>([]);
const selectedTunnelName = ref("");
const runtimeStatus = ref<RunnerRuntimeStatus>({
  running: false,
  pid: 0,
  started_at: "",
  node_address: "",
  tunnel_names: [],
  command: "",
  last_error: "",
  log_lines: [],
});

const isRunning = computed(() => runtimeStatus.value.running);
const logText = computed(() => logs.value.join("\n"));
const statusLabel = computed(() => (isRunning.value ? "运行中" : "未运行"));
const statusColor = computed(() => (isRunning.value ? "green" : "amber"));
const activeTunnelNames = computed(() => {
  const names = runtimeStatus.value.tunnel_names ?? [];
  if (names.length > 0) {
    return names.filter((item) => item.trim() !== "");
  }

  const fallbackName = (runtimeStatus.value.tunnel_name || "").trim();
  return fallbackName ? [fallbackName] : [];
});
const activeTunnelNameSet = computed(() => new Set(activeTunnelNames.value));
const activeTunnels = computed(() => {
  if (!isRunning.value) {
    return [] as typeof tunnels.value;
  }
  if (activeTunnelNameSet.value.size === 0) {
    return [] as typeof tunnels.value;
  }
  return tunnels.value.filter((tunnel) => activeTunnelNameSet.value.has(tunnel.name));
});

const joinHostPort = (host: string, port?: number | null) => {
  const normalizedHost = host.trim();
  if (!normalizedHost) {
    return "-";
  }
  if (!port || port <= 0) {
    return normalizedHost;
  }
  return `${normalizedHost}:${port}`;
};

const formatRuntimeRemote = (tunnel: {
  customDomain: string;
  remote: string;
  remotePort: number;
}) => {
  const customDomain = (tunnel.customDomain || "").trim();
  if (customDomain) {
    return customDomain;
  }
  const remote = (tunnel.remote || "").trim();
  if (remote && remote !== "-") {
    return remote;
  }
  const runtimeNodeAddress = (runtimeStatus.value.node_address || "").trim();
  if (!runtimeNodeAddress) {
    return remote || "-";
  }
  return joinHostPort(runtimeNodeAddress, tunnel.remotePort);
};

const resolveRuntimeServer = (fallback: string) => {
  const runtimeNodeAddress = (runtimeStatus.value.node_address || "").trim();
  if (activeTunnels.value.length > 1) {
    return `${activeTunnels.value.length} 条隧道`;
  }
  const activeTunnel = activeTunnels.value[0];
  const customDomain = (activeTunnel?.customDomain || "").trim();
  if (customDomain) {
    return customDomain;
  }
  if (!runtimeNodeAddress) {
    return fallback;
  }
  return joinHostPort(runtimeNodeAddress, activeTunnel?.remotePort);
};

const resolveSummaryProtocol = (fallback: string) => {
  if (activeTunnels.value.length === 0) {
    return fallback;
  }

  const protocols = new Set(
    activeTunnels.value
      .map((tunnel) => tunnel.type.trim().toUpperCase())
      .filter((protocol) => protocol !== ""),
  );

  if (protocols.size === 1) {
    return Array.from(protocols)[0];
  }
  if (protocols.size > 1) {
    return "MULTI";
  }
  return fallback;
};

const statusToColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("run") || normalized.includes("online")) {
    return "success";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "error";
  }
  if (normalized.includes("stop") || normalized.includes("offline")) {
    return "grey";
  }
  return "info";
};

const statusToText = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("run") || normalized.includes("online")) {
    return "在线";
  }
  if (normalized.includes("error") || normalized.includes("fail")) {
    return "异常";
  }
  if (normalized.includes("stop") || normalized.includes("offline")) {
    return "离线";
  }
  return status || "未知";
};

const loadRunnerData = async () => {
  errorMessage.value = "";

  await withGlobalLoading(async () => {
    try {
      const [runnerData, tunnelData, runnerRuntime] = await Promise.all([
        getRunnerData(0),
        getTunnelsOverview(1, 100, 2),
        getRunnerRuntimeStatus(),
      ]);
      runtimeStatus.value = runnerRuntime;

      const nodeMap = new Map<
        number,
        { ip_address: string; frps_port: number }
      >();
      for (const node of runnerData.nodes ?? []) {
        nodeMap.set(Number(node.id), {
          ip_address: node.ip_address || "-",
          frps_port: Number(node.frps_port || 0),
        });
      }

      const tunnelList = tunnelData.list ?? [];
      tunnels.value = tunnelList.map((item) => {
        const node = nodeMap.get(Number(item.node_id));
        const remoteHost = (item.node_address || "").trim() || node?.ip_address || "node";
        const remotePort = item.remote_port || 0;
        const customDomain = (item.custom_domain || "").trim();

        return {
          name: item.name,
          remark: item.remark || item.name,
          type: item.type || "-",
          customDomain,
          local: `${item.local_ip}:${item.local_port}`,
          remote: customDomain || joinHostPort(remoteHost, remotePort),
          remotePort,
          status: statusToText(item.status),
          statusColor: statusToColor(item.status),
        };
      });
      const currentTunnelName = runnerData.current_tunnel?.name || "";
      const tunnelNames = new Set(tunnels.value.map((item) => item.name));
      if (!tunnelNames.has(selectedTunnelName.value)) {
        selectedTunnelName.value = tunnelNames.has(currentTunnelName)
          ? currentTunnelName
          : (tunnels.value[0]?.name ?? "");
      }

      const currentNode = runnerData.current_tunnel
        ? nodeMap.get(Number(runnerData.current_tunnel.node_id))
        : undefined;
      const fallbackNodeAddress = currentNode
        ? `${currentNode.ip_address}:${currentNode.frps_port || runnerData.current_tunnel?.remote_port || "-"}`
        : runnerData.nodes?.[0]
          ? `${runnerData.nodes[0].ip_address}:${runnerData.nodes[0].frps_port}`
          : "-";

      summary.value = {
        server: resolveRuntimeServer(fallbackNodeAddress),
        protocol: resolveSummaryProtocol((runnerData.current_tunnel?.type || "-").toUpperCase()),
        version: runnerData.version || "-",
        pid: runtimeStatus.value.pid > 0 ? String(runtimeStatus.value.pid) : "-",
        startTime: runtimeStatus.value.started_at
          ? new Date(runtimeStatus.value.started_at).toLocaleString()
          : "-",
      };

      const runtimeLines = runtimeStatus.value.log_lines || [];
      logs.value =
        runtimeLines.length > 0
          ? runtimeLines
          : ["暂无日志，点击“启动”后可查看 frpc 输出。"];
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "加载 Runner 数据失败，请稍后重试";
    }
  });
};

const syncRuntimeStatus = async () => {
  if (runtimePolling.value) {
    return;
  }
  runtimePolling.value = true;
  try {
    const status = await getRunnerRuntimeStatus();
    runtimeStatus.value = status;
    const fallbackServer = summary.value.server;
    summary.value = {
      ...summary.value,
      server: resolveRuntimeServer(fallbackServer),
      protocol: resolveSummaryProtocol(summary.value.protocol),
      pid: status.pid > 0 ? String(status.pid) : "-",
      startTime: status.started_at
        ? new Date(status.started_at).toLocaleString()
        : "-",
    };

    const runtimeLines = status.log_lines || [];
    logs.value =
      runtimeLines.length > 0
        ? runtimeLines
        : ["暂无日志，点击“启动”后可查看 frpc 输出。"];
  } finally {
    runtimePolling.value = false;
  }
};

const handleStartRunner = async () => {
  errorMessage.value = "";
  if (!selectedTunnelName.value) {
    errorMessage.value = "请先选择隧道";
    return;
  }
  runningAction.value = true;
  try {
    runtimeStatus.value = await startRunner(selectedTunnelName.value);
    await loadRunnerData();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "启动 runner 失败，请稍后重试";
  } finally {
    runningAction.value = false;
  }
};

const handleStopRunner = async () => {
  errorMessage.value = "";
  runningAction.value = true;
  try {
    runtimeStatus.value = await stopRunner();
    await loadRunnerData();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "停止 runner 失败，请稍后重试";
  } finally {
    runningAction.value = false;
  }
};

onMounted(() => {
  void loadRunnerData();
  runtimePollTimer = setInterval(() => {
    void syncRuntimeStatus();
  }, 1200);
});

onBeforeUnmount(() => {
  if (runtimePollTimer) {
    clearInterval(runtimePollTimer);
    runtimePollTimer = null;
  }
});
</script>

<template>
  <div class="runner-page">
    <Banner v-if="errorMessage" type="danger" :description="errorMessage" />
    <Banner v-else-if="runtimeStatus.last_error" type="warning" :description="`上次运行错误：${runtimeStatus.last_error}`" />

    <Card class="runner-hero" :bordered="true">
      <div class="runner-hero-content">
        <div class="runner-summary">
          <div class="runner-title"><IconTerminal style="font-size: 23px" /><h1>LoliaCLI Runner</h1></div>
          <p>
          已连接至 Runner {{ summary.server !== "-" ? `(${summary.server})` : "" }}（{{ summary.protocol }}）
          </p>
          <div class="runner-tags">
            <Tag :color="statusColor" type="light">{{ statusLabel }}</Tag>
            <Tag color="blue" type="ghost">PID {{ summary.pid }}</Tag>
            <Tag color="cyan" type="ghost">{{ summary.version }}</Tag>
            <Tag color="grey" type="ghost">启动于 {{ summary.startTime }}</Tag>
          </div>
        </div>
        <div class="runner-actions">
          <Button theme="solid" type="primary"
          :loading="runningAction"
          :disabled="isRunning || runningAction || !selectedTunnelName"
          @click="handleStartRunner"><IconPlay style="font-size: 15px" />启动</Button>
          <Button theme="light" type="danger"
          :loading="runningAction"
          :disabled="!isRunning || runningAction"
          @click="handleStopRunner"><IconStop style="font-size: 15px" />停止</Button>
          <Button theme="light" type="tertiary" @click="loadRunnerData"><IconRefresh style="font-size: 15px" />刷新</Button>
        </div>
      </div>
    </Card>

    <div class="runner-grid">
      <Card class="runner-panel" :bordered="true" :body-style="{ padding: '0' }">
        <div class="panel-heading"><h2>隧道状态</h2><Tag color="blue" type="ghost">{{ activeTunnels.length }} 条规则</Tag></div>
        <div class="tunnel-status-list">
          <div v-for="tunnel in activeTunnels" :key="`${tunnel.name}-${tunnel.local}`" class="tunnel-status-item">
            <div>
              <strong>{{ tunnel.remark }}</strong>
              <span>{{ tunnel.local }} → {{ formatRuntimeRemote(tunnel) }}</span>
            </div>
            <Tag :color="tunnel.statusColor === 'success' ? 'green' : 'blue'" type="light" size="small">{{ tunnel.status }}</Tag>
          </div>
          <div v-if="activeTunnels.length === 0" class="runner-empty">Runner 未运行，暂无已启动隧道。</div>
        </div>
      </Card>

      <Card class="runner-panel log-panel" :bordered="true" :body-style="{ padding: '0' }">
        <div class="panel-heading log-heading"><div><h2>frpc 运行日志</h2><span>启动命令：{{ runtimeStatus.command || "-" }}</span></div></div>
        <div class="log-viewport"><pre class="log-text-mono" v-text="logText" /></div>
      </Card>
    </div>
  </div>
</template>
<style scoped>
.runner-page { display: flex; flex-direction: column; gap: 18px; }
.runner-hero, .runner-panel { background: var(--app-surface); border-color: var(--app-border); }
.runner-hero-content { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.runner-title, .runner-tags, .runner-actions { display: flex; align-items: center; gap: 8px; }
.runner-title { color: var(--app-accent); }
.runner-title h1 { margin: 0; color: var(--app-text-strong); font-size: 22px; }
.runner-summary p { margin: 5px 0 14px; color: var(--app-text); font-size: 13px; }
.runner-tags { flex-wrap: wrap; }
.runner-actions { flex-wrap: wrap; justify-content: flex-end; }
.runner-actions :deep(.semi-button-content) { display: flex; align-items: center; gap: 6px; }
.runner-grid { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.7fr); gap: 18px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; min-height: 68px; padding: 0 20px; border-bottom: 1px solid var(--app-border); box-sizing: border-box; }
.panel-heading h2 { margin: 0; color: var(--app-text-strong); font-size: 16px; }
.tunnel-status-list { display: flex; flex-direction: column; gap: 10px; padding: 16px; }
.tunnel-status-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px; border: 1px solid var(--app-border); border-radius: 6px; }
.tunnel-status-item div { min-width: 0; }
.tunnel-status-item strong, .tunnel-status-item span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tunnel-status-item strong { color: var(--app-text-strong); font-size: 14px; }
.tunnel-status-item span, .log-heading span { margin-top: 3px; color: var(--app-text); font-size: 11px; }
.runner-empty { padding: 24px; color: var(--app-text); font-size: 13px; text-align: center; }
.log-heading { justify-content: flex-start; }
.log-viewport { height: 420px; overflow: auto; background: #101216; color: #d7dce2; }
.log-text-mono { min-width: max-content; margin: 0; padding: 18px; font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
@media (max-width: 900px) {
  .runner-hero-content { align-items: flex-start; flex-direction: column; }
  .runner-actions { justify-content: flex-start; }
  .runner-grid { grid-template-columns: 1fr; }
}
</style>
