import { apiRequest } from "./http";
import { isWails } from "./platform";

export async function hasOAuthToken(): Promise<boolean> {
  if (isWails()) {
    return Boolean(await (window as any).go.services.TokenService.HasOAuthToken());
  }
  const response = await apiRequest<{ authenticated: boolean }>("/api/auth/status");
  return response.authenticated;
}

export async function beginOAuthLogin(): Promise<boolean> {
  if (isWails()) {
    return Boolean(await (window as any).go.services.TokenService.BeginOAuthLogin());
  }
  const response = await apiRequest<{ url: string }>("/api/auth/login", { method: "POST" });
  window.location.assign(response.url);
  return true;
}

export async function clearOAuthToken(): Promise<void> {
  if (isWails()) {
    await (window as any).go.services.TokenService.ClearOAuthToken();
    return;
  }
  await apiRequest("/api/auth/logout", { method: "POST" });
}