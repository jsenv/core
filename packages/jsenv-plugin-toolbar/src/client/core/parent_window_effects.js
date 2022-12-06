import { batch } from "@preact/signals"

import { stateFromLocalStorage } from "./toolbar_state_context.js"
import {
  addExternalCommandCallback,
  sendEventToParent,
} from "./parent_window_actions.js"
import { openedSignal } from "./toolbar_open_signals.js"
import { themeSignal } from "./theme_signals.js"
import { notificationsEnabledSignal } from "./notification_signals.js"
import { animationsEnabledSignal } from "./animation_signals.js"
import { initToolbarUI } from "../ui/toolbar_ui.js"

addExternalCommandCallback(
  "initToolbarCore",
  ({ theme, opened, animationsEnabled, notificationsEnabled }) => {
    batch(() => {
      // opened
      if (typeof stateFromLocalStorage.opened === "boolean") {
        openedSignal.value = stateFromLocalStorage.opened
      } else if (typeof opened === "boolean") {
        openedSignal.value = opened
      }
      // theme
      if (typeof stateFromLocalStorage.theme === "boolean") {
        themeSignal.value = stateFromLocalStorage.theme
      } else if (typeof theme === "boolean") {
        themeSignal.value = theme
      }
      // notificationsEnabled
      if (typeof stateFromLocalStorage.notificationsEnabled === "boolean") {
        notificationsEnabledSignal.value =
          stateFromLocalStorage.notificationsEnabled
      } else if (typeof notificationsEnabled === "boolean") {
        notificationsEnabledSignal.value = notificationsEnabled
      }
      // animationsEnabled
      if (typeof stateFromLocalStorage.animationsEnabled === "boolean") {
        animationsEnabledSignal.value = stateFromLocalStorage.animationsEnabled
      } else if (typeof animationsEnabled === "boolean") {
        animationsEnabledSignal.value = animationsEnabled
      }
    })
    sendEventToParent("toolbar_core_ready")
  },
)
addExternalCommandCallback("initToolbarUI", () => {
  // for the first render, force disable animations
  const animationsEnabled = animationsEnabledSignal.value
  if (animationsEnabled) {
    animationsEnabledSignal.value = false
  }
  initToolbarUI()
  if (animationsEnabled) {
    animationsEnabledSignal.value = true
  }
})
sendEventToParent("toolbar_ready")
