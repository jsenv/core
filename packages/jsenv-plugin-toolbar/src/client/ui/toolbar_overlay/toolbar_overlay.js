import { hideSettings } from "../toolbar_settings/toolbar_settings.js"
import { hideAllTooltips } from "../tooltips/tooltips.js"

export const renderToolbarOverlay = () => {
  const toolbarOverlay = document.querySelector("#toolbar_overlay")
  toolbarOverlay.onclick = () => {
    hideAllTooltips()
    hideSettings()
  }
}
