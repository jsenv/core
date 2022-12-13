import { effect } from "@preact/signals"

import { toolbarStateSignal } from "./toolbar_state_signals.js"
import { sendEventToParent } from "./parent_window_actions.js"

effect(() => {
  const toolbarState = toolbarStateSignal.value
  localStorage.setItem("jsenv_toolbar", JSON.stringify(toolbarState))
  sendEventToParent("toolbar_state_change", toolbarState)
})
