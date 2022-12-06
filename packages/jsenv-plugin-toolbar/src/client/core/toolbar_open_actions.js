import { openedSignal } from "./toolbar_open_signals.js"

export const openToolbar = () => {
  openedSignal.value = true
}

export const closeToolbar = () => {
  openedSignal.value = false
}
