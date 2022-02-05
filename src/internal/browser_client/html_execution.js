import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_in_document.js"
import { displayErrorNotification } from "./error_in_notification.js"

export const initHtmlExecution = () => {
  const result = {}

  let ready = true
  let pendingExecutionCount = 0
  let resolveJsExecutionsPromise
  const jsExecutionsPromise = new Promise((resolve) => {
    resolveJsExecutionsPromise = resolve
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
    if (pendingExecutionCount === 0 && ready) {
      resolveJsExecutionsPromise()
    }
  }
  const waitUntil = async (asyncFunction) => {
    ready = false
    await asyncFunction
    ready = true
    if (pendingExecutionCount === 0) {
      resolveJsExecutionsPromise()
    }
  }
  const addExecution = async ({ name, promise, currentScript }) => {
    onExecutionStart()
    promise.then(
      (namespace) => {
        const executionResult = {
          status: "completed",
          namespace,
          coverage: window.__coverage__,
        }
        onExecutionSettled(name, executionResult)
      },
      (e) => {
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

  const getHtmlExecutionResult = async () => {
    await jsExecutionsPromise
    let status = "completed"
    let exceptionSource = ""
    Object.keys(result).forEach((key) => {
      result[key] = null // to get always same order for Object.keys(executionResult)
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

  // by default wait until document.readyState is completed before considering
  // html execution as done. If this is not enough we can use an other strategy
  // before considering html execution as done
  waitUntil(async () => {
    if (document.readyState === "complete") {
      return
    }
    await new Promise((resolve) => {
      const loadCallback = () => {
        window.removeEventListener("load", loadCallback)
        resolve()
      }
      window.addEventListener("load", loadCallback)
    })
  })

  return {
    waitUntil,
    addExecution,
    getHtmlExecutionResult,
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
