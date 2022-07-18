import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_overlay.js"
import { displayErrorNotification } from "./error_in_notification.js"

const { __html_supervisor__ } = window

export const installHtmlSupervisor = ({
  rootDirectoryUrl,
  logs,
  measurePerf,
  errorOverlay,
}) => {
  const errorTransformer = null // could implement error stack remapping if needed
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
    if (measurePerf) {
      performance.mark(`execution_start`)
    }
  }
  const onExecutionSettled = (name, executionResult) => {
    if (measurePerf) {
      performance.measure(`execution`, `execution_start`)
    }
    scriptExecutionResults[name] = executionResult
    pendingExecutionCount--
    if (pendingExecutionCount === 0 && collectCalled) {
      resolveScriptExecutionsPromise()
    }
  }
  const onExecutionError = (
    executionResult,
    { currentScript, errorExposureInNotification = false },
  ) => {
    const error = executionResult.error
    if (error && error.code === "NETWORK_FAILURE") {
      if (currentScript) {
        const currentScriptErrorEvent = new Event("error")
        currentScript.dispatchEvent(currentScriptErrorEvent)
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

  const performExecution = async ({
    src,
    type,
    currentScript,
    execute,
    // https://developer.mozilla.org/en-US/docs/web/html/element/script
  }) => {
    if (logs) {
      console.group(`[jsenv] loading ${type} ${src}`)
    }
    onExecutionStart(src)
    let completed
    let result
    let error
    try {
      result = await execute()
      completed = true
    } catch (e) {
      completed = false
      error = e
    }
    if (completed) {
      const executionResult = {
        status: "completed",
        namespace: result,
        coverage: window.__coverage__,
      }
      onExecutionSettled(src, executionResult)
      if (logs) {
        console.log(`${type} load ended`)
        console.groupEnd()
      }
      return
    }
    const executionResult = {
      status: "errored",
      coverage: window.__coverage__,
    }
    let errorExposureInConsole = true
    if (error.name === "SyntaxError") {
      // errorExposureInConsole = false
    }
    if (errorTransformer) {
      try {
        error = await errorTransformer(error)
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
    if (logs) {
      console.groupEnd()
    }
  }

  const classicExecutionQueue = createExecutionQueue(performExecution)
  const deferedExecutionQueue = createExecutionQueue(performExecution)
  deferedExecutionQueue.waitFor(
    new Promise((resolve) => {
      if (
        document.readyState === "interactive" ||
        document.readyState === "complete"
      ) {
        resolve()
      } else {
        document.addEventListener("readystatechange", () => {
          if (document.readyState === "interactive") {
            resolve()
          }
        })
      }
    }),
  )
  __html_supervisor__.addScriptToExecute = async (scriptToExecute) => {
    if (scriptToExecute.async) {
      performExecution(scriptToExecute)
      return
    }
    const useDeferQueue =
      scriptToExecute.defer || scriptToExecute.type === "js_module"
    if (useDeferQueue) {
      // defer must wait for classic script to be done
      const classicExecutionPromise = classicExecutionQueue.getPromise()
      if (classicExecutionPromise) {
        deferedExecutionQueue.waitFor(classicExecutionPromise)
      }
      deferedExecutionQueue.executeAsap(scriptToExecute)
    } else {
      classicExecutionQueue.executeAsap(scriptToExecute)
    }
  }

  __html_supervisor__.collectScriptResults = async () => {
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

  const { scriptsToExecute } = __html_supervisor__
  const copy = scriptsToExecute.slice()
  scriptsToExecute.length = 0
  copy.forEach((scriptToExecute) => {
    __html_supervisor__.addScriptToExecute(scriptToExecute)
  })

  if (errorOverlay) {
    window.addEventListener("error", (errorEvent) => {
      if (!errorEvent.isTrusted) {
        // ignore custom error event (not sent by browser)
        return
      }
      const { error } = errorEvent
      displayErrorInDocument(error, {
        rootDirectoryUrl,
        url: errorEvent.filename,
        line: errorEvent.lineno,
        column: errorEvent.colno,
        reportedBy: "browser",
      })
    })
    if (window.__jsenv_event_source_client__) {
      window.__jsenv_event_source_client__.addEventCallbacks({
        error_while_serving_file: (serverErrorEvent) => {
          const {
            reason,
            stack,
            url,
            line,
            column,
            contentFrame,
            requestedRessource,
            isFaviconAutoRequest,
          } = JSON.parse(serverErrorEvent.data)
          if (isFaviconAutoRequest) {
            return
          }
          displayErrorInDocument(
            {
              message: reason,
              stack: stack ? `${stack}\n\n${contentFrame}` : contentFrame,
            },
            {
              rootDirectoryUrl,
              url,
              line,
              column,
              reportedBy: "server",
              requestedRessource,
            },
          )
        },
      })
    }
  }
}

export const superviseScriptTypeModule = ({ src, isInline }) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "js_module",
    isInline,
    execute: () => import(new URL(src, document.location.href).href),
  })
}

const createExecutionQueue = (execute) => {
  const scripts = []

  let promiseToWait = null
  const waitFor = async (promise) => {
    promiseToWait = promise
    promiseToWait.then(
      () => {
        promiseToWait = null
        dequeue()
      },
      () => {
        promiseToWait = null
        dequeue()
      },
    )
  }

  const executeAsap = async (script) => {
    if (promiseToWait) {
      scripts.push(script)
      return
    }
    waitFor(execute(script))
  }

  const dequeue = () => {
    const scriptWaiting = scripts.shift()
    if (scriptWaiting) {
      __html_supervisor__.addScriptToExecute(scriptWaiting)
    }
  }

  return {
    waitFor,
    executeAsap,
    getPromise: () => promiseToWait,
  }
}
