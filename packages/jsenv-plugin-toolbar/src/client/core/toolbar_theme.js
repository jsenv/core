import { createPreference } from "./preferences.js"

const THEME_DARK = "dark"
const THEME_LIGHT = "light"
const themePreference = createPreference("jsenv_toolbar_theme")

export const getCurrentTheme = () => {
  return themePreference.has() ? themePreference.get() : THEME_DARK
}

export const switchToLightTheme = () => {
  themePreference.set(THEME_LIGHT)
  setTheme(THEME_LIGHT)
}

export const switchToDefaultTheme = () => {
  themePreference.set(THEME_DARK)
  setTheme(THEME_DARK)
}

const setTheme = (theme) => {
  document.querySelector("html").setAttribute("data-theme", theme)
}
