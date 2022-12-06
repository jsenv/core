import { hideAllTooltip } from "../tooltip.js"
import { hideSettings } from "../toolbar_settings/toolbar_settings.js"

export const renderToolbarOverlay = () => {
  const toolbarOverlay = document.querySelector("#toolbar-overlay")
  toolbarOverlay.onclick = () => {
    hideAllTooltip()
    hideSettings()
  }
}
