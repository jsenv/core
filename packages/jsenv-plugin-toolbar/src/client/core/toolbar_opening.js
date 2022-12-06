import { toolbarState, updateToolbarState } from "./toolbar_state.js"
import { addExternalCommandCallback } from "./parent_window_communication.js"

export const getToolbarIsOpened = () => {
  return toolbarState.opened
}

export const getToolbarIsClosed = () => {
  return !toolbarState.opened
}

export const openToolbar = () => {
  updateToolbarState({
    opened: true,
  })
}

export const closeToolbar = () => {
  updateToolbarState({
    opened: false,
  })
}

addExternalCommandCallback("openToolbar", openToolbar)
addExternalCommandCallback("closeToolbar", closeToolbar)

window.__jsenv__.toolbar = {
  open: openToolbar,
  close: closeToolbar,
}
