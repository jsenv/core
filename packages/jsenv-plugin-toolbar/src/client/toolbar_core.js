import { updateToolbarState } from "./toolbar_state.js"
import { addExternalCommandCallback } from "./core/parent_window_communication.js"
import { renderToolbar, showToolbar, hideToolbar } from "./ui/toolbar_ui.js"

// const { currentScript } = document
addExternalCommandCallback("renderToolbar", ({ logs }) => {
  renderToolbar({ logs })
})
addExternalCommandCallback("showToolbar", () => {
  showToolbar()
})
addExternalCommandCallback("hideToolbar", () => {
  hideToolbar()
})
updateToolbarState({
  ready: true,
})
