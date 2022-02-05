import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_in_document.js"
import { displayErrorNotification } from "./error_in_notification.js"

export const initHtmlSupervisor = ({ errorTransformer } = {}) => {
  const result = {}

  let collectCalled = false
  let pendingExecutionCount = 0
  let resolveScriptExecutionsPromise
  const scriptExecutionsPromise = new Promise((resolve) => {
    resolveScriptExecutionsPromise = resolve
  })
  const onExecutionStart = (name) => {
    result[name] = null // ensure execution order is reflected into result
    pendingExecutionCount++
    performance.mark(`execution_start`)
  }
  const onExecutionSettled = (name, executionResult) => {
    performance.measure(`execution`, `execution_start`)
    result[name] = executionResult
    pendingExecutionCount--
    if (pendingExecutionCount === 0 && collectCalled) {
      resolveScriptExecutionsPromise()
    }
  }
  const addExecution = async ({ name, promise, currentScript }) => {
    onExecutionStart(name)
    promise.then(
      (namespace) => {
        const executionResult = {
          status: "completed",
          namespace,
          coverage: window.__coverage__,
        }
        onExecutionSettled(name, executionResult)
      },
      async (e) => {
        if (errorTransformer) {
          try {
            e = await errorTransformer(e)
          } catch (e) {}
        }
        const executionResult = {
          status: "errored",
          error: e,
          coverage: window.__coverage__,
        }
        onExecutionError(executionResult, { currentScript })
        onExecutionSettled(name, executionResult)
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
    Object.keys(result).forEach((key) => {
      const executionResult = result[key]
      if (executionResult.status === "errored") {
        status = "errored"
        exceptionSource = executionResult.exceptionSource
      }
    })
    return {
      status,
      ...(status === "errored" ? { exceptionSource } : {}),
      startTime: getNavigationStartTime(),
      endTime: Date.now(),
      result,
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
    errorExposureInConsole = true,
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
    const { parsingError } = error
    const globalErrorEvent = new Event("error")
    if (parsingError) {
      globalErrorEvent.filename = parsingError.filename
      globalErrorEvent.lineno = parsingError.lineNumber
      globalErrorEvent.message = parsingError.message
      globalErrorEvent.colno = parsingError.columnNumber
    } else {
      globalErrorEvent.filename = error.filename
      globalErrorEvent.lineno = error.lineno
      globalErrorEvent.message = error.message
      globalErrorEvent.colno = error.columnno
    }
    window.dispatchEvent(globalErrorEvent)
  }
  if (errorExposureInConsole) {
    console.error(error)
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
