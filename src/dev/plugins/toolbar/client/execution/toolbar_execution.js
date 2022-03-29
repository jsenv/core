import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"
import { toggleTooltip } from "../tooltip/tooltip.js"
import { notifyExecutionResult } from "../notification/toolbar_notification.js"

export const renderExecutionInToolbar = async () => {
  // reset file execution indicator ui
  applyExecutionIndicator()
  removeForceHideElement(document.querySelector("#execution-indicator"))

  const { status, startTime, endTime } =
    await window.parent.__html_supervisor__.getScriptExecutionResults()
  const execution = { status, startTime, endTime }
  applyExecutionIndicator(execution)
  const executionStorageKey = window.location.href
  const previousExecution = sessionStorage.hasOwnProperty(executionStorageKey)
    ? JSON.parse(sessionStorage.getItem(executionStorageKey))
    : undefined
  notifyExecutionResult(executionStorageKey, execution, previousExecution)
  sessionStorage.setItem(executionStorageKey, JSON.stringify(execution))
}

const applyExecutionIndicator = ({
  status = "running",
  startTime,
  endTime,
} = {}) => {
  const executionIndicator = document.querySelector("#execution-indicator")
  enableVariant(executionIndicator, { execution: status })
  const variantNode = executionIndicator.querySelector("[data-when-active]")

  variantNode.querySelector("button").onclick = () =>
    toggleTooltip(executionIndicator)
  variantNode.querySelector(".tooltip").textContent = computeText({
    status,
    startTime,
    endTime,
  })
}

// relative time: https://github.com/tc39/proposal-intl-relative-time/issues/118
const computeText = ({ status, startTime, endTime }) => {
  if (status === "completed") {
    return `Execution completed in ${endTime - startTime}ms at ${Date.now()}`
  }
  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`
  }
  if (status === "running") {
    return "Executing..."
  }
  return ""
}
