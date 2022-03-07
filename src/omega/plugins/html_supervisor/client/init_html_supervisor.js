import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_in_document.js"
import { displayErrorNotification } from "./error_in_notification.js"

export const initHtmlSupervisor = ({ errorTransformer } = {}) => {
  const scriptExecutionResults = {}

  let collectCalled = false
  let pendingExecutionCount = 0
  let resolveScriptExecutionsPromise
  const scriptExecutionsPromise = new Promise((resolve) => {
    resolveScriptExecutionsPromise = resolve
  })
  const onExecutionStart = (name) => {
    scriptExecutionResults[name] = null // ensure execution order is reflected into the object
    pendingExecutionCount++
    performance.mark(`execution_start`)
  }
  const onExecutionSettled = (name, executionResult) => {
    performance.measure(`execution`, `execution_start`)
    scriptExecutionResults[name] = executionResult
    pendingExecutionCount--
    if (pendingExecutionCount === 0 && collectCalled) {
      resolveScriptExecutionsPromise()
    }
  }
  const addExecution = async ({ type, src, currentScript, promise }) => {
    console.group(`[jsenv] loading ${type} ${src}`)
    onExecutionStart(src)
    promise.then(
      (namespace) => {
        const executionResult = {
          status: "completed",
          namespace,
          coverage: window.__coverage__,
        }
        onExecutionSettled(src, executionResult)
        console.log(`${type} load ended`)
        console.groupEnd()
      },
      async (e) => {
        let error = e
        const executionResult = {
          status: "errored",
          coverage: window.__coverage__,
        }
        let errorExposureInConsole = true
        if (e.name === "SyntaxError") {
          // errorExposureInConsole = false
        }
        if (errorTransformer) {
          try {
            error = await errorTransformer(e)
          } catch (e) {}
        }
        executionResult.error = error
        onExecutionSettled(src, executionResult)
        onExecutionError(executionResult, {
          currentScript,
        })
        if (errorExposureInConsole) {
          if (typeof window.reportError === "function") {
            window.reportError(error)
          } else {
            console.error(error)
          }
        }
        console.groupEnd()
      },
    )
  }

  const collectScriptResults = async () => {
    collectCalled = true
    if (pendingExecutionCount === 0) {
      resolveScriptExecutionsPromise()
    } else {
      await scriptExecutionsPromise
    }

    let status = "completed"
    let exceptionSource = ""
    Object.keys(scriptExecutionResults).forEach((key) => {
      const scriptExecutionResult = scriptExecutionResults[key]
      if (scriptExecutionResult.status === "errored") {
        status = "errored"
        exceptionSource = scriptExecutionResult.exceptionSource
      }
    })
    return {
      status,
      ...(status === "errored" ? { exceptionSource } : {}),
      startTime: getNavigationStartTime(),
      endTime: Date.now(),
      scriptExecutionResults,
    }
  }

  return {
    addExecution,
    collectScriptResults,
  }
}

const onExecutionError = (
  executionResult,
  {
    currentScript,
    errorExposureInNotification = false,
    errorExposureInDocument = true,
  },
) => {
  const error = executionResult.error
  if (error && error.code === "NETWORK_FAILURE") {
    if (currentScript) {
      const errorEvent = new Event("error")
      currentScript.dispatchEvent(errorEvent)
    }
  } else if (typeof error === "object") {
    const globalErrorEvent = new Event("error")
    globalErrorEvent.filename = error.filename
    globalErrorEvent.lineno = error.line || error.lineno
    globalErrorEvent.colno = error.column || error.columnno
    globalErrorEvent.message = error.message
    window.dispatchEvent(globalErrorEvent)
  }
  if (errorExposureInNotification) {
    displayErrorNotification(error)
  }
  if (errorExposureInDocument) {
    displayErrorInDocument(error)
  }
  executionResult.exceptionSource = unevalException(error)
  delete executionResult.error
}

const getNavigationStartTime = () => {
  try {
    return window.performance.timing.navigationStart
  } catch (e) {
    return Date.now()
  }
}
