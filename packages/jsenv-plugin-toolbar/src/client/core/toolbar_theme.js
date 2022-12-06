import { toolbarState, updateToolbarState } from "./toolbar_state.js"

const THEME_DARK = "dark"
const THEME_LIGHT = "light"

export const getToolbarTheme = () => {
  return toolbarState.theme
}

export const switchToLightTheme = () => {
  updateToolbarState({
    theme: THEME_LIGHT,
  })
  setTheme(THEME_LIGHT)
}

export const switchToDefaultTheme = () => {
  updateToolbarState({
    theme: THEME_DARK,
  })
  setTheme(THEME_DARK)
}

const setTheme = (theme) => {
  document.querySelector("html").setAttribute("data-theme", theme)
}
