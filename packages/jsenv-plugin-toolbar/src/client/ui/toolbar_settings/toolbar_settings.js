import {
  toolbarSectionIsActive,
  deactivateToolbarSection,
  activateToolbarSection,
  updateIframeOverflowOnParentWindow,
} from "../util/dom.js"
import { enableVariant } from "../variant.js"
import { renderToolbarAnimationSetting } from "./toolbar_animation_setting.js"
import { renderToolbarNotificationSetting } from "./toolbar_notification_setting.js"
import { renderToolbarThemeSetting } from "./toolbar_theme_setting.js"

export const renderToolbarSettings = () => {
  document.querySelector("#settings_open_button").onclick = toggleSettings
  document.querySelector("#settings_close_button").onclick = toggleSettings
  disableWarningStyle()

  renderToolbarAnimationSetting()
  renderToolbarNotificationSetting()
  renderToolbarThemeSetting()
}

const toggleSettings = () => {
  if (settingsAreVisible()) {
    hideSettings()
  } else {
    showSettings()
  }
}

export const enableWarningStyle = () => {
  enableVariant(document.querySelector("#settings_open_button"), {
    has_warning: "yes",
  })
}

export const disableWarningStyle = () => {
  enableVariant(document.querySelector("#settings_open_button"), {
    has_warning: "no",
  })
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
