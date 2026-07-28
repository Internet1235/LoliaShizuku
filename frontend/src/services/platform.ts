import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

export const isWails = () => Boolean((window as any).go?.services);

export function openExternalURL(url: string) {
  if (isWails()) {
    BrowserOpenURL(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}