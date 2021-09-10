import { removeForceHideElement, activateToolbarSection } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"
import { createHorizontalBreakpoint } from "../util/responsive.js"
import { toggleTooltip } from "../tooltip/tooltip.js"
import { notifyExecutionResult } from "../notification/toolbar.notification.js"

const WINDOW_MEDIUM_WIDTH = 570

export const renderExecutionInToolbar = ({ executedFileRelativeUrl }) => {
  // reset file execution indicator ui
  applyExecutionIndicator()
  removeForceHideElement(document.querySelector("#execution-indicator"))

  // apply responsive design on fileInput if needed + add listener on resize screen
  const input = document.querySelector("#file-input")
  const fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH)
  const handleFileWidthBreakpoint = () => {
    resizeInput(input, fileWidthBreakpoint)
  }
  handleFileWidthBreakpoint()
  fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint)
  input.value = executedFileRelativeUrl
  resizeInput(input, fileWidthBreakpoint)

  activateToolbarSection(document.querySelector("#file"))
  removeForceHideElement(document.querySelector("#file"))

  window.parent.__jsenv__.executionResultPromise.then(
    ({ status, startTime, endTime }) => {
      const execution = { status, startTime, endTime }
      applyExecutionIndicator(execution)

      const executionStorageKey = executedFileRelativeUrl
      const previousExecution = sessionStorage.hasOwnProperty(
        executionStorageKey,
      )
        ? JSON.parse(sessionStorage.getItem(executionStorageKey))
        : undefined
      notifyExecutionResult(
        executedFileRelativeUrl,
        execution,
        previousExecution,
      )

      sessionStorage.setItem(executedFileRelativeUrl, JSON.stringify(execution))
    },
  )
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

const computeText = ({ status, startTime, endTime }) => {
  if (status === "completed") {
    return `Execution completed in ${endTime - startTime}ms`
  }

  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`
  }

  return ""
}

const resizeInput = (input, fileWidthBreakpoint) => {
  const size = fileWidthBreakpoint.isBelow() ? 20 : 40
  if (input.value.length > size) {
    input.style.width = `${size}ch`
  } else {
    input.style.width = `${input.value.length}ch`
  }
}
