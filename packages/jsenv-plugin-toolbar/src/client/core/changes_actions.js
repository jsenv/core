import { changesTooltipOpenedSignal } from "./changes_signals.js"

export const openChangesToolip = () => {
  changesTooltipOpenedSignal.value = true
}

export const closeChangesToolip = () => {
  changesTooltipOpenedSignal.value = false
}
