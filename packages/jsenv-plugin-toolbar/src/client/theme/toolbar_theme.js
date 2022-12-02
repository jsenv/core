import { createPreference } from "../util/preferences.js"

const DARK_THEME = "dark"
const LIGHT_THEME = "light"
const themePreference = createPreference("theme")

export const renderToolbarTheme = () => {
  const theme = getThemePreference()
  const checkbox = document.querySelector("#checkbox-dark-theme")
  checkbox.checked = theme === DARK_THEME
  setTheme(theme)
  checkbox.onchange = () => {
    if (checkbox.checked) {
      setThemePreference(DARK_THEME)
      setTheme(DARK_THEME)
    } else {
      setThemePreference(LIGHT_THEME)
      setTheme(LIGHT_THEME)
    }
  }
}

const getThemePreference = () => {
  return themePreference.has() ? themePreference.get() : DARK_THEME
}

const setThemePreference = (value) => {
  themePreference.set(value)
  setTheme(value)
}

const setTheme = (theme) => {
  document.querySelector("html").setAttribute("data-theme", theme)
}
