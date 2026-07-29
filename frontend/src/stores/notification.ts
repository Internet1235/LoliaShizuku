import { defineStore } from "pinia";

export type NotificationType = "success" | "error" | "info";

export type AppNotification = {
  id: number;
  message: string;
  type: NotificationType;
};

const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

export const useNotificationStore = defineStore("notification", {
  state: () => ({
    notifications: [] as AppNotification[],
    nextNotificationID: 0,
  }),
  actions: {
    show(message: string, type: NotificationType = "info") {
      const id = ++this.nextNotificationID;
      this.notifications.push({ id, message, type });
      dismissTimers.set(id, setTimeout(() => this.dismiss(id), 3200));
    },
    success(message: string) {
      this.show(message, "success");
    },
    error(message: string) {
      this.show(message, "error");
    },
    dismiss(id?: number) {
      if (id === undefined) {
        this.notifications = [];
        dismissTimers.forEach((timer) => clearTimeout(timer));
        dismissTimers.clear();
        return;
      }

      this.notifications = this.notifications.filter((notification) => notification.id !== id);
      const timer = dismissTimers.get(id);
      if (timer) clearTimeout(timer);
      dismissTimers.delete(id);
    },
  },
});