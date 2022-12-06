import { effect } from "@preact/signals"

import { stateFromLocalStorage } from "./toolbar_state_context.js"
import { themeSignal } from "./theme_signals.js"

if (stateFromLocalStorage.theme) {
  themeSignal.value = stateFromLocalStorage.theme
}
effect(() => {
  const theme = themeSignal.value
  document.querySelector("html").setAttribute("data-theme", theme)
})
