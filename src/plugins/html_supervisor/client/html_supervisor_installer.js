import { unevalException } from "./uneval_exception.js"
import { displayErrorInDocument } from "./error_in_document.js"
import { displayErrorNotification } from "./error_in_notification.js"

const { __html_supervisor__ } = window

export const installHtmlSupervisor = ({ logs, measurePerf }) => {
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

  const queue = []
  let previousDonePromise = null
  const dequeue = () => {
    const next = queue.shift()
    if (next) {
      __html_supervisor__.addScriptToExecute(next)
    } else {
      const nextDefered = deferQueue.shift()
      if (nextDefered) {
        __html_supervisor__.addScriptToExecute(nextDefered)
      }
    }
  }
  const deferQueue = []
  let previousDeferDonePromise = null
  __html_supervisor__.addScriptToExecute = async (scriptToExecute) => {
    if (scriptToExecute.async) {
      performExecution(scriptToExecute)
      return
    }
    const useDeferQueue =
      scriptToExecute.defer || scriptToExecute.type === "js_module"
    if (useDeferQueue) {
      if (document.readyState !== "interactive") {
        deferQueue.push(scriptToExecute)
        return
      }
      if (previousDonePromise) {
        // defer must wait for the regular script to be done
        deferQueue.push(scriptToExecute)
        return
      }
      if (previousDeferDonePromise) {
        deferQueue.push(scriptToExecute)
        return
      }
      previousDeferDonePromise = performExecution(scriptToExecute)
      await previousDeferDonePromise
      previousDeferDonePromise = null
      dequeue()
      return
    }
    if (previousDonePromise) {
      queue.push(scriptToExecute)
      return
    }
    previousDonePromise = performExecution(scriptToExecute)
    await previousDonePromise
    previousDonePromise = null
    dequeue()
  }
  if (
    document.readyState !== "interactive" &&
    document.readyState !== "complete"
  ) {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        const nextDefered = deferQueue.shift()
        if (nextDefered) {
          __html_supervisor__.addScriptToExecute(nextDefered)
        }
      }
    })
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
}

export const superviseScriptTypeModule = ({ src, isInline }) => {
  __html_supervisor__.addScriptToExecute({
    src,
    type: "js_module",
    isInline,
    execute: () => import(new URL(src, document.location.href).href),
  })
}
