import { effect } from "@preact/signals"

import {
  executionSignal,
  previousExecutionSignal,
} from "./execution_signals.js"
import { notifyExecutionResult } from "./execution_actions.js"

effect(() => {
  const execution = executionSignal.value
  if (execution) {
    sessionStorage.setItem(window.location.href, JSON.stringify(execution))
  }
})

effect(() => {
  const execution = executionSignal.value
  const previousExecution = previousExecutionSignal.value
  if (execution) {
    notifyExecutionResult(execution, previousExecution)
  }
})
