import { computed } from "@preact/signals"

import { executionTooltipRequestedSignal } from "./execution_signals.js"
import { serverTooltipOpenedSignal } from "./server_signals.js"

export const someTooltipOpenedSignal = computed(() => {
  const executionTooltipOpened = executionTooltipRequestedSignal.value
  const serverTooltipOpened = serverTooltipOpenedSignal.value
  return executionTooltipOpened || serverTooltipOpened
})
