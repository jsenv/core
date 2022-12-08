import { computed } from "@preact/signals"

import { executionTooltipSignal } from "./execution_signals.js"
import { serverTooltipSignal } from "./server_signals.js"

export const someTooltipOpenedSignal = computed(() => {
  const executionTooltip = executionTooltipSignal.value
  const serverTooltip = serverTooltipSignal.value
  return executionTooltip === "opened" || serverTooltip === "opened"
})
