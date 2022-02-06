import { fetchUrl } from "@jsenv/core/src/internal/browser_utils/fetch_browser.js"
import { inferContextFrom, createUrlContext } from "../url_context.js"

import { getRessourceResponseError } from "./ressource_response_error.js"
import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_in_document.js"
import { displayErrorNotification } from "./error_in_notification.js"

export const initHtmlSupervisor = ({ errorTransformer } = {}) => {
  const scriptExecutionResults = {}

  const urlContext = createUrlContext(
    inferContextFrom({
      url: window.location.href,
    }),
  )

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
  const addExecution = async ({
    src,
    currentScript,
    promise,
    improveErrorWithFetch = false,
  }) => {
    onExecutionStart(src)
    promise.then(
      (namespace) => {
        const executionResult = {
          status: "completed",
          namespace,
          coverage: window.__coverage__,
        }
        onExecutionSettled(src, executionResult)
      },
      async (e) => {
        if (improveErrorWithFetch) {
          const url = new URL(src, window.location.href).href
          let response
          try {
            response = await fetchUrl(url)
          } catch (e) {
            e.code = "NETWORK_FAILURE"
            throw e
          }
          const responseError = await getRessourceResponseError({
            urlContext,
            contentTypeExpected: "application/javascript",
            type: "js_module",
            url,
            importerUrl: window.location.href,
            response,
          })
          if (responseError) {
            e = responseError
          }
        }
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
        onExecutionSettled(src, executionResult)
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
