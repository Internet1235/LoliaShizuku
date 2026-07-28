import { apiRequest } from "./http";

type CenterServiceBinding = {
  GetDashboard: () => Promise<any>;
  GetNodes: () => Promise<any>;
  CreateTunnel: (input: CreateTunnelInput) => Promise<any>;
  GetRunnerRuntimeStatus: () => Promise<any>;
  GetTunnelsOverview: (page: number, limit: number, days: number) => Promise<any>;
  GetRunnerData: (tunnelID: number) => Promise<any>;
  GetTunnelDetail: (tunnelName: string) => Promise<any>;
  UpdateTunnel: (tunnelName: string, input: UpdateTunnelInput) => Promise<any>;
  StartRunner: (tunnelNames: string[]) => Promise<RunnerRuntimeStatus>;
  StopRunner: () => Promise<any>;
  GetTrafficDaily: (days: number) => Promise<any>;
};

function getCenterServiceBinding(): CenterServiceBinding | null {
  const svc = (window as any).go?.services?.CenterService;
  return svc ? svc as CenterServiceBinding : null;
}

function parseError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return new Error(message);
    }
  }
  return new Error("请求失败");
}

export interface DashboardData {
  user: {
    avatar: string;
    bandwidth_limit: number;
    email: string;
    id: number;
    max_tunnel_count: number;
    role: string;
    traffic_limit: number;
    traffic_used: number;
    username: string;
  };
  traffic: {
    user_id: string;
    username: string;
    traffic_limit: number;
    traffic_used: number;
    traffic_remaining: number;
  };
  tunnel: {
    count: number;
    total: number;
  };
  tunnels: TunnelOverviewItem[];
  app: {
    version: string;
  };
  home: {
    user_count: number;
    tunnel_count: number;
    total_traffic_used: number;
  };
}

export interface TunnelOverviewItem {
  bandwidth_limit: number;
  custom_domain: string;
  id: number;
  local_ip: string;
  local_port: number;
  name: string;
  node_address?: string;
  node_id: number;
  node_name?: string;
  remark: string;
  remote_port: number;
  status: string;
  type: string;
  total_in?: number;
  total_out?: number;
  total_traffic?: number;
}

export interface NodeItem {
  id: number;
  name: string;
  region_code: string;
  status: string;
  supported_protocols: string[];
  need_kyc: boolean;
  beian_required: boolean;
  frps_version: string;
  agent_version: string;
  sponsor: string;
  bandwidth: number;
  remark: string;
  load: number;
}

export interface NodeListData {
  nodes: NodeItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTunnelInput {
  node_id: number;
  type: string;
  local_ip: string;
  local_port: number;
  remote_port: number;
  custom_domain: string;
  remark: string;
}

export interface CreateTunnelResult {
  created: boolean;
}

export interface DailyTrafficResponse {
  days: number;
  daily_stats: Array<{
    date: string;
    total_traffic: number;
    tunnel_stats?: Array<{
      tunnel_name: string;
      remark: string;
      total_traffic: number;
    }>;
  }>;
}

export interface TunnelsOverviewData {
  list: TunnelOverviewItem[];
  page: number;
  limit: number;
  total: number;
  total_page: number;
}

export interface RunnerData {
  config: string;
  version: string;
  nodes: Array<{
    id: number;
    name: string;
    status: string;
    ip_address: string;
    frps_port: number;
  }>;
  current_tunnel?: TunnelOverviewItem;
}

export interface TunnelDetailData {
  auto_tls: boolean;
  bandwidth_limit: number;
  client_version: string;
  created_at: string;
  custom_domain: string;
  id: number;
  local_ip: string;
  local_port: number;
  name: string;
  node_address: string;
  node_id: number;
  node_name: string;
  remark: string;
  remote_port: number;
  status: string;
  tunnel_token: string;
  type: string;
}

export interface UpdateTunnelInput {
  local_ip: string;
  local_port: number;
  custom_domain: string;
  remark: string;
  config: {
    auto_tls: boolean;
    proxy_protocol_version: string;
    protocol: string;
  };
}

export interface UpdateTunnelResult {
  auto_tls: boolean;
  custom_domain: string;
  id: number;
  name: string;
  node_id: number;
  status: string;
  type: string;
}

export interface RunnerRuntimeStatus {
  running: boolean;
  pid: number;
  started_at?: string;
  tunnel_name?: string;
  tunnel_names?: string[];
  node_address?: string;
  command?: string;
  last_error?: string;
  log_lines?: string[];
}

export async function getDashboard(): Promise<DashboardData> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetDashboard()) as DashboardData
      : await apiRequest<DashboardData>("/api/center/dashboard");
  } catch (error) {
    throw parseError(error);
  }
}

export async function getTunnelsOverview(
  page = 1,
  limit = 50,
  days = 2,
): Promise<TunnelsOverviewData> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetTunnelsOverview(page, limit, days)) as TunnelsOverviewData
      : await apiRequest<TunnelsOverviewData>(`/api/center/tunnels?page=${page}&limit=${limit}&days=${days}`);
  } catch (error) {
    throw parseError(error);
  }
}

export async function getNodes(): Promise<NodeListData> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetNodes()) as NodeListData
      : await apiRequest<NodeListData>("/api/center/nodes");
  } catch (error) {
    throw parseError(error);
  }
}

export async function createTunnel(input: CreateTunnelInput): Promise<CreateTunnelResult> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.CreateTunnel(input)) as CreateTunnelResult
      : await apiRequest<CreateTunnelResult>("/api/center/tunnel/create", {
          method: "POST",
          body: JSON.stringify(input),
        });
  } catch (error) {
    throw parseError(error);
  }
}

export async function getRunnerData(tunnelID = 0): Promise<RunnerData> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetRunnerData(tunnelID)) as RunnerData
      : await apiRequest<RunnerData>(`/api/center/runner/data?tunnel_id=${tunnelID}`);
  } catch (error) {
    throw parseError(error);
  }
}

export async function getTunnelDetail(tunnelName: string): Promise<TunnelDetailData> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetTunnelDetail(tunnelName)) as TunnelDetailData
      : await apiRequest<TunnelDetailData>(`/api/center/tunnel/detail?name=${encodeURIComponent(tunnelName)}`);
  } catch (error) {
    throw parseError(error);
  }
}

export async function updateTunnel(
  tunnelName: string,
  input: UpdateTunnelInput,
): Promise<UpdateTunnelResult> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.UpdateTunnel(tunnelName, input)) as UpdateTunnelResult
      : await apiRequest<UpdateTunnelResult>(`/api/center/tunnel/detail?name=${encodeURIComponent(tunnelName)}`, {
          method: "PUT",
          body: JSON.stringify(input),
        });
  } catch (error) {
    throw parseError(error);
  }
}

export async function getRunnerRuntimeStatus(): Promise<RunnerRuntimeStatus> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetRunnerRuntimeStatus()) as RunnerRuntimeStatus
      : await apiRequest<RunnerRuntimeStatus>("/api/center/runner/status");
  } catch (error) {
    throw parseError(error);
  }
}

export async function startRunner(
  tunnelNames: string | string[] = [],
): Promise<RunnerRuntimeStatus> {
  try {
    const svc = getCenterServiceBinding();
    const normalizedTunnelNames = Array.isArray(tunnelNames)
      ? tunnelNames
      : tunnelNames.trim()
        ? [tunnelNames]
        : [];
    return svc
      ? (await svc.StartRunner(normalizedTunnelNames)) as RunnerRuntimeStatus
      : await apiRequest<RunnerRuntimeStatus>("/api/center/runner/start", {
          method: "POST",
          body: JSON.stringify({ tunnel_names: normalizedTunnelNames }),
        });
  } catch (error) {
    throw parseError(error);
  }
}

export async function stopRunner(): Promise<RunnerRuntimeStatus> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.StopRunner()) as RunnerRuntimeStatus
      : await apiRequest<RunnerRuntimeStatus>("/api/center/runner/stop", { method: "POST" });
  } catch (error) {
    throw parseError(error);
  }
}

export async function getTrafficDaily(days = 7): Promise<DailyTrafficResponse> {
  try {
    const svc = getCenterServiceBinding();
    return svc
      ? (await svc.GetTrafficDaily(days)) as DailyTrafficResponse
      : await apiRequest<DailyTrafficResponse>(`/api/center/traffic/daily?days=${days}`);
  } catch (error) {
    throw parseError(error);
  }
}
