import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_overlay.js"
import { displayErrorNotification } from "./error_in_notification.js"

const { __html_supervisor__ } = window

const supervisedScripts = []

export const installHtmlSupervisor = ({
  rootDirectoryUrl,
  logs,
  measurePerf,
  errorOverlay,
  errorBaseUrl,
  openInEditor,
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

  const performExecution = async (
    {
      src,
      type,
      currentScript,
      execute,
      // https://developer.mozilla.org/en-US/docs/web/html/element/script
    },
    { reload = false } = {},
  ) => {
    if (logs) {
      console.group(`[jsenv] loading ${type} ${src}`)
    }
    onExecutionStart(src)
    let completed
    let result
    let error
    try {
      const urlObject = new URL(src, window.location)
      if (reload) {
        urlObject.searchParams.set("hmr", Date.now())
      }
      result = await execute(urlObject.href)
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
    if (!supervisedScripts.includes(scriptToExecute)) {
      supervisedScripts.push(scriptToExecute)
      scriptToExecute.reload = () => {
        return performExecution(scriptToExecute, { reload: true })
      }
    }

    if (scriptToExecute.async) {
      performExecution(scriptToExecute)
      return
    }
    const useDeferQueue =
      scriptToExecute.defer || scriptToExecute.type === "module"
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
        errorBaseUrl,
        openInEditor,
        url: errorEvent.filename,
        line: errorEvent.lineno,
        column: errorEvent.colno,
        reportedBy: "browser",
      })
    })
    if (window.__server_events__) {
      const isExecuting = () => {
        if (pendingExecutionCount > 0) {
          return true
        }
        if (
          document.readyState === "loading" ||
          document.readyState === "interactive"
        ) {
          return true
        }
        if (window.__reloader__ && window.__reloader__.status === "reloading") {
          return true
        }
        return false
      }

      window.__server_events__.addEventCallbacks({
        error_while_serving_file: (serverErrorEvent) => {
          if (!isExecuting()) {
            return
          }
          const {
            message,
            stack,
            traceUrl,
            traceLine,
            traceColumn,
            traceMessage,
            requestedRessource,
            isFaviconAutoRequest,
          } = JSON.parse(serverErrorEvent.data)
          if (isFaviconAutoRequest) {
            return
          }
          // setTimeout is to ensure the error
          // dispatched on window by browser is displayed first,
          // then the server error replaces it (because it contains more information)
          setTimeout(() => {
            displayErrorInDocument(
              {
                message,
                stack:
                  stack && traceMessage
                    ? `${stack}\n\n${traceMessage}`
                    : stack
                    ? stack
                    : traceMessage
                    ? `\n${traceMessage}`
                    : "",
              },
              {
                rootDirectoryUrl,
                errorBaseUrl,
                openInEditor,
                url: traceUrl,
                line: traceLine,
                column: traceColumn,
                reportedBy: "server",
                requestedRessource,
              },
            )
          }, 10)
        },
      })
    }
  }
}

__html_supervisor__.reloadSupervisedScript = ({ type, src }) => {
  const supervisedScript = supervisedScripts.find(
    (supervisedScriptCandidate) => {
      if (type && supervisedScriptCandidate.type !== type) {
        return false
      }
      if (supervisedScriptCandidate.src !== src) {
        return false
      }
      return true
    },
  )
  if (supervisedScript) {
    supervisedScript.reload()
  }
}

export const superviseScriptTypeModule = ({ src, isInline }) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "module",
    isInline,
    execute: (url) => import(url),
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
