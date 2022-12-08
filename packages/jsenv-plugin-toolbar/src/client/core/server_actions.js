import { serverTooltipRequestedSignal } from "./server_signals.js"

export const requestServerTooltip = () => {
  serverTooltipRequestedSignal.value = true
}

export const closeServerTooltip = () => {
  serverTooltipRequestedSignal.value = false
}
