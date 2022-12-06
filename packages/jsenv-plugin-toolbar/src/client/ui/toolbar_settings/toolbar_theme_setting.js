import {
  getToolbarTheme,
  switchToDefaultTheme,
  switchToLightTheme,
} from "../../core/toolbar_theme.js"

export const renderToolbarThemeSetting = () => {
  const checkbox = document.querySelector("#checkbox_dark_theme")
  checkbox.checked = getToolbarTheme() === "dark"
  checkbox.onchange = () => {
    if (checkbox.checked) {
      switchToDefaultTheme()
    } else {
      switchToLightTheme()
    }
  }
}
