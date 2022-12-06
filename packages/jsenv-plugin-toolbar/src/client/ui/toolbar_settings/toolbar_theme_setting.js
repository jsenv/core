import {
  toolbarThemeSignal,
  switchToDefaultTheme,
  switchToLightTheme,
} from "../../core/toolbar_theme.js"

export const renderToolbarThemeSetting = () => {
  const checkbox = document.querySelector("#checkbox_dark_theme")
  checkbox.checked = toolbarThemeSignal.value === "dark"
  checkbox.onchange = () => {
    if (checkbox.checked) {
      switchToDefaultTheme()
    } else {
      switchToLightTheme()
    }
  }
}
