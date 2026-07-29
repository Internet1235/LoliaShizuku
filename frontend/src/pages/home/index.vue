<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import {
  VisXYContainer,
  VisLine,
  VisAxis,
  VisArea,
  VisCrosshair,
  VisTooltip,
} from "@unovis/vue";
import { useElementSize } from "@vueuse/core";
import { Avatar, Card, Tag } from "@kousum/semi-ui-vue";
import { IconActivity, IconHistogram, IconServer } from "@kousum/semi-icons-vue";
import {
  getDashboard,
  getTrafficDaily,
  type DailyTrafficResponse,
} from "@/services/center";
import { useGlobalLoadingStore } from "@/stores/globalLoading";
import { useNotificationStore } from "@/stores/notification";

defineOptions({
  name: "HomePage",
});

type TunnelData = {
  name: string;
  amount: number;
};

type DataRecord = {
  date: Date;
  amount: number;
  tunnels: TunnelData[];
};

const globalLoadingStore = useGlobalLoadingStore();
const notificationStore = useNotificationStore();
const withGlobalLoading = <T>(task: () => Promise<T>) =>
  globalLoadingStore.withGlobalLoading(task);

const userInfo = ref({
  name: "-",
  email: "-",
  avatarUrl: "",
});

const stats = ref({
  availableTraffic: 0,
  tunnelCount: 0,
  tunnelLimit: 0,
  bandwidthLimit: "-",
});

const dailyTraffic = ref<DailyTrafficResponse | null>(null);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，早点休息喵";
  if (hour < 9) return "早上好~ 又是元气满满的一天呢";
  if (hour < 12) return "上午好，加油喵";
  if (hour < 14) return "中午好，记得吃饭哦";
  if (hour < 18) return "下午好，继续加油w";
  if (hour < 22) return "晚上好，记得放松一下喵";
  return "夜深了，早点休息喵";
});

const cardRef = ref<HTMLElement | null>(null);
const { width } = useElementSize(cardRef);

const data = computed<DataRecord[]>(() => {
  if (!dailyTraffic.value?.daily_stats) {
    return [];
  }

  return dailyTraffic.value.daily_stats.map((stat) => ({
    date: new Date(stat.date),
    amount: Number(stat.total_traffic || 0) / (1024 * 1024 * 1024),
    tunnels:
      stat.tunnel_stats?.map((tunnel) => ({
        name: tunnel.remark || tunnel.tunnel_name,
        amount: Number(tunnel.total_traffic || 0) / (1024 * 1024 * 1024),
      })) ?? [],
  }));
});

const x = (_: DataRecord, i: number) => i;
const y = (d: DataRecord) => d.amount;

const total = computed(() =>
  data.value.reduce((acc: number, current) => acc + current.amount, 0),
);

const formatNumber = (value: number) => `${value.toFixed(2)} GB`;

const formatBytes = (value: number): string => {
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

const formatDate = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
};

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
    return "";
  }
  return formatDate(data.value[i].date);
};

const template = (d: DataRecord) => {
  if (!d) return "";

  const tunnelItems = (d.tunnels || [])
    .map(
      (tunnel) => `
      <div style="display:flex; justify-content:space-between; gap:1rem; padding:0.25rem 0;">
        <span style="opacity:0.8;">${tunnel.name}</span>
        <span style="font-weight:600;">${tunnel.amount.toFixed(2)}GB</span>
      </div>
    `,
    )
    .join("");

  return `
    <div>
      <div style="font-weight:600;">
        ${formatDate(d.date)}
      </div>
      <div style="font-weight:500; margin-bottom:0.5rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(127,127,127,0.25);">
        ${formatNumber(d.amount)}
      </div>
      ${tunnelItems}
    </div>
  `;
};

const loadDashboard = async () => {
  try {
    const dashboard = await getDashboard();
    const trafficLimit = Number(
      dashboard.traffic?.traffic_limit ?? dashboard.user?.traffic_limit ?? 0,
    );
    const trafficUsed = Number(
      dashboard.traffic?.traffic_used ?? dashboard.user?.traffic_used ?? 0,
    );
    const trafficRemaining = Number(
      dashboard.traffic?.traffic_remaining ??
        Math.max(trafficLimit - trafficUsed, 0),
    );

    userInfo.value = {
      name: dashboard.user?.username || "-",
      email: dashboard.user?.email || "-",
      avatarUrl: dashboard.user?.avatar || "",
    };

    stats.value = {
      availableTraffic: trafficRemaining,
      tunnelCount: Number(
        dashboard.tunnel?.count ?? dashboard.tunnels?.length ?? 0,
      ),
      tunnelLimit: Number(dashboard.user?.max_tunnel_count ?? 0),
      bandwidthLimit:
        dashboard.user?.bandwidth_limit !== undefined
          ? `${dashboard.user.bandwidth_limit} Mbps`
          : "-",
    };
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "加载主页数据失败");
  }
};

const loadDailyTraffic = async () => {
  try {
    dailyTraffic.value = await getTrafficDaily(7);
  } catch (error) {
    notificationStore.error(error instanceof Error ? error.message : "加载近七天流量失败");
  }
};

const loadData = async () => {
  await withGlobalLoading(async () => {
    await Promise.all([loadDashboard(), loadDailyTraffic()]);
  });
};

const chartVars = {
  "--vis-crosshair-line-stroke-color": "var(--app-accent)",
  "--vis-crosshair-circle-stroke-color": "var(--app-surface)",
  "--vis-axis-grid-color": "var(--app-border)",
  "--vis-axis-tick-color": "var(--app-border)",
  "--vis-axis-tick-label-color": "var(--app-text)",
  "--vis-tooltip-background-color": "var(--app-surface)",
  "--vis-tooltip-border-color": "var(--app-border)",
  "--vis-tooltip-text-color": "var(--app-text-strong)",
  "--vis-tooltip-border-radius": "6px",
} as const;

// 格式化带宽 (MB/s 转换为 Mbps)
const formatBandwidth = (mbps: number) => {
    return (mbps * 8).toFixed(0)
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div class="home-page">
    <Card class="welcome-card" :bordered="true">
      <div class="welcome-content">
        <Avatar :src="userInfo.avatarUrl" size="large">{{ userInfo.name.slice(0, 1) }}</Avatar>
        <div>
          <h1>{{ userInfo.name }}，{{ greeting }}</h1>
          <p>{{ userInfo.email }}</p>
        </div>
        <Tag color="pink" type="light">Lolia FRP</Tag>
      </div>
    </Card>

    <div class="stat-grid">
      <Card class="stat-card" :bordered="true"><div class="stat-icon traffic"><IconHistogram /></div><div><span>可用流量</span><strong>{{ formatBytes(stats.availableTraffic) }}</strong></div></Card>
      <Card class="stat-card" :bordered="true"><div class="stat-icon tunnel"><IconServer /></div><div><span>隧道数量</span><strong>{{ stats.tunnelCount }} / {{ stats.tunnelLimit }}</strong></div></Card>
      <Card class="stat-card" :bordered="true"><div class="stat-icon bandwidth"><IconActivity /></div><div><span>带宽限制</span><strong>{{ stats.bandwidthLimit === "-" ? "-" : formatBandwidth(Number(stats.bandwidthLimit.split(" ")[0])) + " Mbps" }}</strong></div></Card>
    </div>

    <Card ref="cardRef" class="chart-card" :bordered="true" :body-style="{ padding: '0' }">
      <div class="chart-heading">
        <div><span>近七天流量使用</span><h2>{{ formatNumber(total) }}</h2></div>
        <Tag color="blue" type="ghost">7 DAYS</Tag>
      </div>
      <div class="chart-body">
        <VisXYContainer
          :data="data"
          :padding="{ top: 40 }"
          class="traffic-chart"
          :width="width"
          :style="chartVars"
        >
          <VisLine
            :x="x"
            :y="y"
            color="var(--app-accent)"
            :lineWidth="3"
          />
          <VisArea
            :x="x"
            :y="y"
            color="var(--app-accent)"
            :opacity="0.1"
          />

          <VisAxis type="x" :x="x" :tick-format="xTicks" />

          <VisCrosshair
            color="var(--app-accent)"
            :template="template"
          />

          <VisTooltip />
        </VisXYContainer>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.home-page { display: flex; flex-direction: column; gap: 18px; }
.welcome-card, .stat-card, .chart-card { background: var(--app-surface); border-color: var(--app-border); }
.welcome-content { display: flex; align-items: center; gap: 16px; }
.welcome-content > div:nth-child(2) { min-width: 0; flex: 1; }
.welcome-content h1 { overflow: hidden; margin: 0; color: var(--app-text-strong); font-size: 20px; letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.welcome-content p { margin: 5px 0 0; color: var(--app-text); font-size: 13px; }
.stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.stat-card :deep(.semi-card-body) { display: flex; align-items: center; gap: 14px; }
.stat-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: var(--app-radius-control); }
.stat-icon.traffic { color: #d83d73; background: #fff0f5; }
.stat-icon.tunnel { color: #187d62; background: #e9f8f2; }
.stat-icon.bandwidth { color: #b26700; background: #fff5df; }
.stat-card span, .chart-heading span { display: block; color: var(--app-text); font-size: 12px; }
.stat-card strong { display: block; margin-top: 5px; color: var(--app-text-strong); font-size: 20px; }
.chart-heading { display: flex; align-items: center; justify-content: space-between; min-height: 74px; padding: 0 20px; border-bottom: 1px solid var(--app-border); }
.chart-heading h2 { margin: 4px 0 0; color: var(--app-text-strong); font-size: 20px; }
.chart-body { padding: 8px 12px 16px 0; }
.traffic-chart { height: 360px; }
@media (max-width: 720px) { .stat-grid { grid-template-columns: 1fr; } .welcome-content :deep(.semi-tag) { display: none; } }
</style>
