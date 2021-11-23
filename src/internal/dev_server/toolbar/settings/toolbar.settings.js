import {
  toolbarSectionIsActive,
  deactivateToolbarSection,
  activateToolbarSection,
  updateIframeOverflowOnParentWindow,
} from "../util/dom.js"

export const renderToolbarSettings = () => {
  document.querySelector("#settings-button").onclick = toggleSettings
  document.querySelector("#button-close-settings").onclick = toggleSettings
}

const toggleSettings = () => {
  if (settingsAreVisible()) {
    hideSettings()
  } else {
    showSettings()
  }
}

export const settingsAreVisible = () => {
  return toolbarSectionIsActive(document.querySelector(`#settings`))
}

export const hideSettings = () => {
  deactivateToolbarSection(document.querySelector(`#settings`))
  updateIframeOverflowOnParentWindow()
}

export const showSettings = () => {
  activateToolbarSection(document.querySelector(`#settings`))
  updateIframeOverflowOnParentWindow()
}
