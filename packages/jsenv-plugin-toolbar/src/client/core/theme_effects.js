import { effect } from "@preact/signals"

import { themeSignal } from "./theme_signals.js"

effect(() => {
  const theme = themeSignal.value
  document.querySelector("html").setAttribute("data-theme", theme)
})
