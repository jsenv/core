import { toolbarState } from "../../core/toolbar_state.js"
import { openToolbar, closeToolbar } from "../../core/toolbar_opening.js"

export const renderToolbarCloseButton = () => {
  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#button-close-toolbar").onclick = () => {
    if (toolbarState.opened) {
      closeToolbar()
    } else {
      openToolbar()
    }
  }
}
