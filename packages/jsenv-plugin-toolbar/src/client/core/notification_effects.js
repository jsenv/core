import { effect } from "@preact/signals"

import { notificationsEnabledSignal } from "./notification_signals.js"
import { closeAllNotifications } from "./notification_actions.js"

effect(() => {
  const notificationsEnabled = notificationsEnabledSignal.value
  if (!notificationsEnabled) {
    closeAllNotifications()
  }
})
