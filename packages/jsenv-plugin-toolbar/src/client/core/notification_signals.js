import { signal } from "@preact/signals"

import { paramsFromWindowName } from "./parent_window_context.js"
import { stateFromLocalStorage } from "./toolbar_state_context.js"

export const notificationsEnabledSignal = signal(
  typeof stateFromLocalStorage.notificationsEnabled === "boolean"
    ? stateFromLocalStorage.notificationsEnabled
    : typeof paramsFromWindowName.notificationsEnabled === "boolean"
    ? paramsFromWindowName.notificationsEnabled
    : false,
)
export const notificationPermissionSignal = signal(Notification.permission)
