import { batch } from "@preact/signals"

import { toolbarOpenedSignal } from "./core/toolbar_opening.js"
import { toolbarThemeSignal } from "./core/toolbar_theme.js"
import { animationsEnabledSignal } from "./core/toolbar_animation.js"
import { notificationsEnabledSignal } from "./core/toolbar_notification.js"
import {
  addExternalCommandCallback,
  sendEventToParent,
} from "./core/parent_window_communication.js"
import { initToolbarUI } from "./ui/toolbar_ui.js"

addExternalCommandCallback(
  "initToolbarCore",
  ({ theme, opened, animationsEnabled, notificationsEnabled }) => {
    const stateFromLocalStorage = localStorage.hasOwnProperty("jsenv_toolbar")
      ? JSON.parse(localStorage.getItem("jsenv_toolbar"))
      : {}
    batch(() => {
      // opened
      if (typeof stateFromLocalStorage.opened === "boolean") {
        toolbarOpenedSignal.value = stateFromLocalStorage.opened
      } else if (typeof opened === "boolean") {
        toolbarOpenedSignal.value = opened
      }
      // theme
      if (typeof stateFromLocalStorage.theme === "boolean") {
        toolbarThemeSignal.value = stateFromLocalStorage.theme
      } else if (typeof theme === "boolean") {
        toolbarThemeSignal.value = theme
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
