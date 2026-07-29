import { defineStore } from "pinia";

export type NotificationType = "success" | "error" | "info";

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

export const useNotificationStore = defineStore("notification", {
  state: () => ({
    visible: false,
    message: "",
    type: "info" as NotificationType,
    notificationID: 0,
  }),
  actions: {
    show(message: string, type: NotificationType = "info") {
      if (dismissTimer) clearTimeout(dismissTimer);
      this.message = message;
      this.type = type;
      this.visible = true;
      this.notificationID += 1;
      dismissTimer = setTimeout(() => this.dismiss(), 3200);
    },
    success(message: string) {
      this.show(message, "success");
    },
    error(message: string) {
      this.show(message, "error");
    },
    dismiss() {
      this.visible = false;
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    },
  },
});