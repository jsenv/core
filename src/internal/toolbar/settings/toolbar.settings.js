import {
  toolbarSectionIsActive,
  deactivateToolbarSection,
  activateToolbarSection,
  updateIframeOverflowOnParentWindow,
} from "../util/dom.js"

export const renderToolbarSettings = () => {
  document.querySelector("#settings-button").onclick = () => toggleSettingsBox()
  document.querySelector("#button-close-settings").onclick = () => toggleSettingsBox()
}

const toggleSettingsBox = () => {
  const settings = document.querySelector(`#settings`)
  if (toolbarSectionIsActive(settings)) {
    deactivateToolbarSection(settings)
    updateIframeOverflowOnParentWindow()
  } else {
    activateToolbarSection(settings)
    updateIframeOverflowOnParentWindow()
  }
}
