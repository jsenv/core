import { effect } from "@preact/signals"

import { stateFromLocalStorage } from "./toolbar_state_context.js"
import { notificationsEnabledSignal } from "./notification_signals.js"
import { closeAllNotifications } from "./notification_actions.js"

if (stateFromLocalStorage.notificationsEnabled) {
  notificationsEnabledSignal.value = true
}
effect(() => {
  const notificationsEnabled = notificationsEnabledSignal.value
  if (!notificationsEnabled) {
    closeAllNotifications()
  }
})
