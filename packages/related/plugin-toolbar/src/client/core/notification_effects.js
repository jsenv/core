import { effect } from "@preact/signals";

import { closeAllNotifications } from "./notification_actions.js";
import { notificationsEnabledSignal } from "./notification_signals.js";

effect(() => {
  const notificationsEnabled = notificationsEnabledSignal.value;
  if (!notificationsEnabled) {
    closeAllNotifications();
  }
});
