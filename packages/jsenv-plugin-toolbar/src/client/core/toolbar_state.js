import { computed, effect } from "@preact/signals"

import { toolbarOpenedSignal } from "./toolbar_opening.js"
import { toolbarThemeSignal } from "./toolbar_theme.js"
import { animationsEnabledSignal } from "./toolbar_animation.js"
import { notificationsEnabledSignal } from "./toolbar_notification.js"
import { sendEventToParent } from "./parent_window_communication.js"

const toolbarStateSignal = computed(() => {
  const toolbarOpened = toolbarOpenedSignal.value
  const toolbarTheme = toolbarThemeSignal.value
  const animationsEnabled = animationsEnabledSignal.value
  const notificationsEnabled = notificationsEnabledSignal.value

  return {
    opened: toolbarOpened,
    theme: toolbarTheme,
    animationsEnabled,
    notificationsEnabled,
  }
})

effect(() => {
  const toolbarState = toolbarStateSignal.value
  localStorage.setItem("jsenv_toolbar", JSON.stringify(toolbarState))
  sendEventToParent("toolbar_state_change", toolbarState)
})
