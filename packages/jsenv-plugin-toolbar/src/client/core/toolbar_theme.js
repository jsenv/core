import { signal, effect } from "@preact/signals"

const THEME_DARK = "dark"
const THEME_LIGHT = "light"

export const toolbarThemeSignal = signal(THEME_DARK)

export const switchToLightTheme = () => {
  toolbarThemeSignal.value = THEME_LIGHT
}

export const switchToDefaultTheme = () => {
  toolbarThemeSignal.value = THEME_DARK
}

effect(() => {
  const toolbarTheme = toolbarThemeSignal.value
  document.querySelector("html").setAttribute("data-theme", toolbarTheme)
})
