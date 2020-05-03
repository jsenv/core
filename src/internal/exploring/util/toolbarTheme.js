import { createPreference } from "./preferences.js"

export const DARK_THEME = "dark"
export const LIGHT_THEME = "light"

const themePreference = createPreference("theme")

export const getThemePreference = () => (themePreference.has() ? themePreference.get() : "dark")

export const setThemePreference = (value) => {
  themePreference.set(value)
  applyToolbarTheme()
}

export const applyToolbarTheme = () => {
  const toolbarTheme = getThemePreference()
  if (!toolbarTheme) return
  document.querySelector("#toolbar").setAttribute("data-theme", toolbarTheme)
}
