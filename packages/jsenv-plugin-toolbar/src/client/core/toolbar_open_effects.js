import { stateFromLocalStorage } from "./toolbar_state_context.js"
import { openedSignal } from "./toolbar_open_signals.js"
import { addExternalCommandCallback } from "./parent_window_communication.js"
import { openToolbar, closeToolbar } from "./toolbar_open_actions.js"

if (stateFromLocalStorage.opened) {
  openedSignal.value = true
}
addExternalCommandCallback("openToolbar", openToolbar)
addExternalCommandCallback("closeToolbar", closeToolbar)
