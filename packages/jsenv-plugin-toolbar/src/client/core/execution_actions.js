import { executionTooltipRequestedSignal } from "./execution_signals.js"

export const requestExecutionTooltip = () => {
  executionTooltipRequestedSignal.value = true
}

export const closeExecutionTooltip = () => {
  executionTooltipRequestedSignal.value = false
}
