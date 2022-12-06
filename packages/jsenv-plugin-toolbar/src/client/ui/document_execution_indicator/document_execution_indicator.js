import { notifyExecutionResult } from "../../core/notification_actions.js"
import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant.js"
import { toggleTooltip } from "../tooltips/tooltips.js"

export const renderDocumentExecutionIndicator = async () => {
  // reset file execution indicator ui
  applyExecutionIndicator()
  removeForceHideElement(
    document.querySelector("#document_execution_indicator"),
  )

  const { status, startTime, endTime } =
    await window.parent.__supervisor__.getDocumentExecutionResult()
  const execution = { status, startTime, endTime }
  applyExecutionIndicator(execution)
  const executionStorageKey = window.location.href
  const previousExecution = sessionStorage.hasOwnProperty(executionStorageKey)
    ? JSON.parse(sessionStorage.getItem(executionStorageKey))
    : undefined
  notifyExecutionResult(executionStorageKey, execution, previousExecution)
  sessionStorage.setItem(executionStorageKey, JSON.stringify(execution))
}

// const changeLink = variantNode.querySelector(".eventsource-changes-link")
// changeLink.innerHTML = reloadMessageCount
// changeLink.onclick = () => {
//   console.log(reloadMessages)
//   // eslint-disable-next-line no-alert
//   window.parent.alert(JSON.stringify(reloadMessages, null, "  "))
// }

// const someFailed = reloadMessages.some((m) => m.status === "failed")
// const somePending = reloadMessages.some((m) => m.status === "pending")
// const applyLink = variantNode.querySelector(".eventsource-reload-link")
// applyLink.innerHTML = someFailed
//   ? "failed"
//   : somePending
//   ? "applying..."
//   : "apply changes"
// applyLink.onclick = someFailed
//   ? () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }
//   : somePending
//   ? () => {}
//   : () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }

// parentEventSourceClient.reloadMessagesSignal.onchange = () => {
//   updateEventSourceIndicator()
// }
// const autoreloadCheckbox = document.querySelector("#toggle-autoreload")
// autoreloadCheckbox.checked = parentEventSourceClient.isAutoreloadEnabled()
// autoreloadCheckbox.onchange = () => {
//   parentEventSourceClient.setAutoreloadPreference(autoreloadCheckbox.checked)
//   updateEventSourceIndicator()
// }

const applyExecutionIndicator = ({
  status = "running",
  startTime,
  endTime,
} = {}) => {
  const executionIndicator = document.querySelector(
    "#document_execution_indicator",
  )
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
    return `Execution completed in ${endTime - startTime}ms`
  }
  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`
  }
  if (status === "running") {
    return "Executing..."
  }
  return ""
}
