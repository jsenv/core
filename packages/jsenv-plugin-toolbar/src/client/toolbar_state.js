import { sendEventToParent } from "./communication/parent_window_communication.js"

export const toolbarState = {
  ready: false,
  visible: false,
  animationsEnabled:
    window.localStorage.getItem("jsenv_toolbar_animation") === "true",
}

export const updateToolbarState = (properties) => {
  Object.assign(toolbarState, properties)
  if (!toolbarState.ready) {
    return
  }
  sendEventToParent("toolbar_state_change", toolbarState)
}
