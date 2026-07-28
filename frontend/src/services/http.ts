export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object"
      ? [payload.error, payload.msg, payload.message].find((value) => typeof value === "string" && value.trim())
      : null;
    if (typeof message !== "string") {
      throw new Error(`请求失败 (${response.status})`);
    }
    throw new Error(message);
  }
  return payload as T;
}