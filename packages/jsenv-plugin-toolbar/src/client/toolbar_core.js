import { updateToolbarState } from "./core/toolbar_state.js"
import { addExternalCommandCallback } from "./core/parent_window_communication.js"
import { initToolbarUI } from "./ui/toolbar_ui.js"

// const { currentScript } = document
addExternalCommandCallback(
  "initToolbar",
  ({ logs = false, visible = false, animationsEnabled = true }) => {
    updateToolbarState({
      firstRender: true,
      logs,
      visible,
      animationsEnabled: false,
    })
    initToolbarUI()
    updateToolbarState({ animationsEnabled })
  },
)
updateToolbarState({
  ready: true,
})
