import { toolbarSectionIsActive, deactivateToolbarSection, activateToolbarSection, updateIframeOverflowOnParentWindow } from "./dom.js";
import { enableVariant } from "./variant.js";
export const renderToolbarSettings = () => {
  document.querySelector("#settings-button").onclick = toggleSettings;
  document.querySelector("#button-close-settings").onclick = toggleSettings;
  disableWarningStyle();
};
const toggleSettings = () => {
  if (settingsAreVisible()) {
    hideSettings();
  } else {
    showSettings();
  }
};
export const enableWarningStyle = () => {
  enableVariant(document.querySelector("#settings-button"), {
    has_warning: "yes"
  });
};
export const disableWarningStyle = () => {
  enableVariant(document.querySelector("#settings-button"), {
    has_warning: "no"
  });
};
export const settingsAreVisible = () => {
  return toolbarSectionIsActive(document.querySelector(`#settings`));
};
export const hideSettings = () => {
  deactivateToolbarSection(document.querySelector(`#settings`));
  updateIframeOverflowOnParentWindow();
};
export const showSettings = () => {
  activateToolbarSection(document.querySelector(`#settings`));
  updateIframeOverflowOnParentWindow();
};