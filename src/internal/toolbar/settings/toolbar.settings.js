import {
  toolbarSectionIsActive,
  deactivateToolbarSection,
  activateToolbarSection,
} from "../util/dom.js"

export const renderToolbarSettings = () => {
  document.querySelector("#settings-button").onclick = () => toggleSettingsBox()
  document.querySelector("#button-close-settings").onclick = () => toggleSettingsBox()
}

const toggleSettingsBox = () => {
  const settings = document.querySelector(`#settings`)
  if (toolbarSectionIsActive(settings)) {
    deactivateToolbarSection(settings)
  } else {
    activateToolbarSection(settings)
  }
}
