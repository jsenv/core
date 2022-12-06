import { signal } from "@preact/signals"

export const notificationsEnabledSignal = signal(false)
export const notificationPermissionSignal = signal(Notification.permission)
