import { initToolbarOpening } from "./toolbar_opening/toolbar_opening.js"
import { initToolbarMenuOverflow } from "./toolbar_menu_overflow/toolbar_menu_overflow.js"
import { renderToolbarOverlay } from "./toolbar_overlay/toolbar_overlay.js"
import { renderDocumentIndexLink } from "./document_index_link/document_index_link.js"
import { renderDocumentExecutionIndicator } from "./document_execution_indicator/document_execution_indicator.js"
import { renderChangesIndicator } from "./changes_indicator/changes_indicator.js"
import { renderServerIndicator } from "./server_indicator/server_indicator.js"
import { renderToolbarSettings } from "./toolbar_settings/toolbar_settings.js"
import { renderToolbarCloseButton } from "./toolbar_close_button/toolbar_close_button.js"

export const initToolbarUI = () => {
  initToolbarOpening()
  initToolbarMenuOverflow()
  renderToolbarOverlay()
  renderDocumentIndexLink()
  renderDocumentExecutionIndicator()
  renderChangesIndicator()
  renderServerIndicator()
  renderToolbarSettings()
  renderToolbarCloseButton()
}
