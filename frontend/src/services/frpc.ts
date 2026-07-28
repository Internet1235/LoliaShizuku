import { apiRequest } from "./http";

type FrpcServiceBinding = {
  GetFrpcStatus: () => Promise<any>;
  GetGitHubMirrorURL: () => Promise<string>;
  InstallOrUpdateFrpc: () => Promise<any>;
  CancelInstallOrUpdateFrpc: () => Promise<void>;
  RemoveFrpc: () => Promise<void>;
  SetGitHubMirrorURL: (url: string) => Promise<void>;
  SetMirrorConfig: (config: FrpcMirrorConfig) => Promise<void>;
};

function getFrpcServiceBinding(): FrpcServiceBinding | null {
  const svc = (window as any).go?.services?.FrpcService;
  return svc ? svc as FrpcServiceBinding : null;
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

export interface FrpcPaths {
  userdata_dir: string;
  frpc_dir: string;
  bin_dir: string;
  binary_path: string;
  download_dir: string;
  state_path: string;
  settings_path: string;
}

export interface FrpcInstalledInfo {
  version: string;
  asset_name: string;
  sha256: string;
  installed_at: string;
  binary_path: string;
  binary_exists: boolean;
}

export interface FrpcReleaseAsset {
  name: string;
  download_url: string;
  content_type: string;
  size: number;
  digest: string;
  sha256: string;
  os: string;
  arch: string;
  archive_format: string;
}

export interface FrpcReleaseInfo {
  tag_name: string;
  name: string;
  html_url: string;
  asset: FrpcReleaseAsset;
}

export interface FrpcMirrorPreset {
  id: string;
  name: string;
  description?: string;
  base_url?: string;
  url_template?: string;
}

export interface FrpcMirrorConfig {
  mode: "official" | "builtin" | "custom";
  preset_id?: string;
  custom_base_url?: string;
  custom_url_template?: string;
}

export interface FrpcStatus {
  goos: string;
  goarch: string;
  paths: FrpcPaths;
  github_mirror_url: string;
  mirror_config: FrpcMirrorConfig;
  builtin_mirrors: FrpcMirrorPreset[];
  installed?: FrpcInstalledInfo;
  latest?: FrpcReleaseInfo;
  update_available: boolean;
  latest_error?: string;
}

export interface FrpcInstallResult {
  release: FrpcReleaseInfo;
  status: FrpcStatus;
}

export async function getFrpcStatus(): Promise<FrpcStatus> {
  try {
    const svc = getFrpcServiceBinding();
    return svc
      ? (await svc.GetFrpcStatus()) as FrpcStatus
      : await apiRequest<FrpcStatus>("/api/frpc/status");
  } catch (error) {
    throw parseError(error);
  }
}

export async function getGitHubMirrorURL(): Promise<string> {
  try {
    const svc = getFrpcServiceBinding();
    if (svc) {
      return (await svc.GetGitHubMirrorURL()) as string;
    }
    const config = await apiRequest<FrpcMirrorConfig>("/api/frpc/mirror");
    return config.custom_base_url ?? "";
  } catch (error) {
    throw parseError(error);
  }
}

export async function installOrUpdateFrpc(): Promise<FrpcInstallResult> {
  try {
    const svc = getFrpcServiceBinding();
    return svc
      ? (await svc.InstallOrUpdateFrpc()) as FrpcInstallResult
      : await apiRequest<FrpcInstallResult>("/api/frpc/install", { method: "POST" });
  } catch (error) {
    throw parseError(error);
  }
}

export async function cancelInstallOrUpdateFrpc(): Promise<void> {
  try {
    const svc = getFrpcServiceBinding();
    if (svc) {
      await svc.CancelInstallOrUpdateFrpc();
    } else {
      await apiRequest("/api/frpc/cancel", { method: "POST" });
    }
  } catch (error) {
    throw parseError(error);
  }
}

export async function removeFrpc(): Promise<void> {
  try {
    const svc = getFrpcServiceBinding();
    if (svc) {
      await svc.RemoveFrpc();
    } else {
      await apiRequest("/api/frpc/remove", { method: "POST" });
    }
  } catch (error) {
    throw parseError(error);
  }
}

export async function setGitHubMirrorURL(url: string): Promise<void> {
  try {
    const svc = getFrpcServiceBinding();
    if (svc) {
      await svc.SetGitHubMirrorURL(url);
    } else {
      await apiRequest("/api/frpc/mirror", {
        method: "PUT",
        body: JSON.stringify(url ? { mode: "custom", custom_base_url: url } : { mode: "official" }),
      });
    }
  } catch (error) {
    throw parseError(error);
  }
}

export async function setMirrorConfig(config: FrpcMirrorConfig): Promise<void> {
  try {
    const svc = getFrpcServiceBinding();
    if (svc) {
      await svc.SetMirrorConfig(config);
    } else {
      await apiRequest("/api/frpc/mirror", {
        method: "PUT",
        body: JSON.stringify(config),
      });
    }
  } catch (error) {
    throw parseError(error);
  }
}
