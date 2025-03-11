import { signal } from "@preact/signals";

import { paramsFromParentWindow } from "./parent_window_context.js";
import { stateFromLocalStorage } from "./toolbar_state_context.js";

export const notificationsEnabledSignal = signal(
  typeof stateFromLocalStorage.notificationsEnabled === "boolean"
    ? stateFromLocalStorage.notificationsEnabled
    : typeof paramsFromParentWindow.notificationsEnabled === "boolean"
      ? paramsFromParentWindow.notificationsEnabled
      : false,
);
export const notificationPermissionSignal = signal(Notification.permission);
