import { serverTooltipOpenedSignal } from "./server_signals.js"

export const openServerTooltip = () => {
  serverTooltipOpenedSignal.value = true
}

export const closeServerTooltip = () => {
  serverTooltipOpenedSignal.value = false
}
