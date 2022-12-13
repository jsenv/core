import { computed } from "@preact/signals"

import { openedSignal } from "./toolbar_open_signals.js"
import { themeSignal } from "./theme_signals.js"
import { animationsEnabledSignal } from "./animation_signals.js"
import { notificationsEnabledSignal } from "./notification_signals.js"

export const toolbarStateSignal = computed(() => {
  const opened = openedSignal.value
  const theme = themeSignal.value
  const animationsEnabled = animationsEnabledSignal.value
  const notificationsEnabled = notificationsEnabledSignal.value

  return {
    opened,
    theme,
    animationsEnabled,
    notificationsEnabled,
  }
})
