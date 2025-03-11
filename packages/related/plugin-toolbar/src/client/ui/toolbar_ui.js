import { renderChangesIndicator } from "./changes_indicator/changes_indicator.js";
import { renderDocumentExecutionIndicator } from "./document_execution_indicator/document_execution_indicator.js";
import { renderDocumentIndexLink } from "./document_index_link/document_index_link.js";
import { renderServerIndicator } from "./server_indicator/server_indicator.js";
import { renderToolbarCloseButton } from "./toolbar_close_button/toolbar_close_button.js";
import { initToolbarMenuOverflow } from "./toolbar_menu_overflow/toolbar_menu_overflow.js";
import { initToolbarOpening } from "./toolbar_opening/toolbar_opening.js";
import { renderToolbarOverlay } from "./toolbar_overlay/toolbar_overlay.js";
import { renderToolbarSettings } from "./toolbar_settings/toolbar_settings.js";

export const initToolbarUI = () => {
  initToolbarOpening();
  initToolbarMenuOverflow();
  renderToolbarOverlay();
  renderDocumentIndexLink();
  renderDocumentExecutionIndicator();
  renderChangesIndicator();
  renderServerIndicator();
  renderToolbarSettings();
  renderToolbarCloseButton();
};
