import { createPreference } from "./preferences.js"

export const DARK_THEME = "dark"
export const LIGHT_THEME = "light"
export const JSENV_THEME = "jsenv"

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

export const registerToolbarTheme = () => {
  const darkThemeRadio = document.querySelector("#dark-theme-radio")
  const lightThemeRadio = document.querySelector("#light-theme-radio")
  const jsenvThemeRadio = document.querySelector("#jsenv-theme-radio")
  darkThemeRadio.checked = getThemePreference() === DARK_THEME
  lightThemeRadio.checked = getThemePreference() === LIGHT_THEME
  jsenvThemeRadio.checked = getThemePreference() === JSENV_THEME
  darkThemeRadio.onclick = () => setThemePreference(DARK_THEME)
  lightThemeRadio.onclick = () => setThemePreference(LIGHT_THEME)
  jsenvThemeRadio.onclick = () => setThemePreference(JSENV_THEME)
  applyToolbarTheme()
}
