import { createCancellationSource, composeCancellationToken } from "@jsenv/cancellation"
import { memoize } from "../../memoize.js"
import { createLivereloading } from "../livereloading/livereloading.js"
import { applyLivereloadIndicator } from "../toolbar/livereload-indicator.js"
import { applyExecutionIndicator } from "../toolbar/execution-indicator.js"
import { loadExploringConfig } from "../util/util.js"
import { jsenvLogger } from "../util/jsenvLogger.js"
import { notifyFileExecution } from "../util/notification.js"

export const pageFileExecution = {
  name: "file-execution",
  match: () => {
    const fileRelativeUrl = document.location.pathname.slice(1)
    if (!fileRelativeUrl) {
      return false
    }
    return true
  },

  navigate: async ({ cancellationToken, mountPromise }) => {
    const fileRelativeUrl = document.location.pathname.slice(1)

    // reset file execution indicator ui
    applyExecutionIndicator()
    window.page = {
      previousExecution: undefined,
      execution: undefined,
      evaluate: () => {
        throw new Error("cannot evaluate, page is not ready")
      },
      execute,
      reload: () => execute(fileRelativeUrl),
    }
    cancellationToken.register(() => {
      window.page = undefined
    })

    let previousExecution
    let currentExecution
    let executionPlaceholder = document.createElement("div")
    const execute = async (fileRelativeUrl) => {
      // we must wait for the page to be in the DOM because iframe will
      // replace placeHolder element
      await mountPromise

      const startTime = Date.now()
      const executionCancellationSource = createCancellationSource()
      const executionCancellationToken = composeCancellationToken(
        cancellationToken,
        executionCancellationSource.token,
      )
      const iframe = document.createElement("iframe")
      const execution = {
        cancel: executionCancellationSource.cancel,
        fileRelativeUrl,
        status: null,
        iframe,
        startTime,
        endTime: null,
        result: null,
      }
      window.page.execution = execution // expose on window
      if (currentExecution) {
        // in case currentExecution is pending, cancel it
        currentExecution.cancel("reload")
        // ensure previous execution is properly cleaned
        currentExecution.iframe.src = "about:blank"
      }
      currentExecution = execution

      // behind loading there is these steps:
      // - fetching exploring config
      // - fetching iframe html (which contains browser-js-file.js)
      execution.status = "loading"
      applyExecutionIndicator("loading")

      const {
        compileServerOrigin,
        htmlFileRelativeUrl,
        outDirectoryRelativeUrl,
        browserRuntimeFileRelativeUrl,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl,
      } = await loadExploringConfig({ cancellationToken: executionCancellationToken })
      if (executionCancellationToken.cancellationRequested) {
        return
      }

      // memoize ensure iframe is lazyly loaded once
      const loadIframe = memoize(() => {
        const loadedPromise = iframeToLoaded(execution.iframe, {
          cancellationToken: executionCancellationToken,
        })
        iframe.src = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`
        replaceElement(executionPlaceholder, iframe) // append iframe in the DOM at the proper location
        executionPlaceholder = iframe // next execution will take place of previous one
        return loadedPromise
      })

      const evaluate = async (fn, ...args) => {
        await loadIframe()
        args = [`(${fn.toString()})`, ...args]
        return performIframeAction(execution.iframe, "evaluate", args, {
          cancellationToken: executionCancellationToken,
          compileServerOrigin,
        })
      }
      window.page.evaluate = evaluate

      // executing means fetching, parsing, executing file imports + file itself
      execution.status = "executing"
      const executionResult = await evaluate((param) => window.execute(param), {
        fileRelativeUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
        browserRuntimeFileRelativeUrl,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl,
        collectNamespace: true,
        collectCoverage: false,
        executionId: fileRelativeUrl,
        errorExposureInConsole: true,
      })
      if (executionCancellationToken.cancellationRequested) {
        return
      }
      execution.status = "executed"
      if (executionResult.status === "errored") {
        // eslint-disable-next-line no-eval
        executionResult.error = window.eval(executionResult.exceptionSource)
        delete executionResult.exceptionSource
      }
      execution.result = executionResult
      const endTime = Date.now()
      execution.endTime = endTime

      const duration = execution.endTime - execution.startTime
      if (executionResult.status === "errored") {
        jsenvLogger.debug(`error during execution`, executionResult.error)
        applyExecutionIndicator("failure", duration)
      } else {
        applyExecutionIndicator("success", duration)
      }
      notifyFileExecution(execution, previousExecution)

      previousExecution = execution
      window.page.previousExecution = previousExecution
    }

    // reset livereload indicator ui
    applyLivereloadIndicator()
    const livereloading = createLivereloading(fileRelativeUrl, {
      onFileChanged: () => {
        execute(fileRelativeUrl)
      },
      onFileRemoved: () => {
        execute(fileRelativeUrl)
      },
      onConnecting: ({ abort }) => {
        applyLivereloadIndicator("connecting", { abort })
      },
      onAborted: ({ connect }) => {
        applyLivereloadIndicator("off", { connect })
      },
      onConnectionFailed: ({ reconnect }) => {
        // make ui indicate the failure providing a way to reconnect manually
        applyLivereloadIndicator("disconnected", { reconnect })
      },
      onConnected: ({ disconnect }) => {
        applyLivereloadIndicator("connected", { disconnect })
        // we have lost connection to the server, we might have missed some file changes
        // let's re-execute the file
        execute(fileRelativeUrl)
      },
    })
    if (livereloading.isEnabled()) {
      livereloading.connect()
    } else {
      applyLivereloadIndicator("off", { connect: livereloading.connect })
      // if not connecting we don't wait for connection to be established before executing
      // we execute immediatly (happen when livereloading is disabled)
      execute(fileRelativeUrl)
    }

    cancellationToken.register(() => {
      livereloading.disconnect()
    })

    return {
      title: fileRelativeUrl,
      element: executionPlaceholder,
    }
  },
}

const replaceElement = (elementToReplace, otherElement) => {
  elementToReplace.parentNode.replaceChild(otherElement, elementToReplace)
}

const iframeToLoaded = (iframe, { cancellationToken }) => {
  return new Promise((resolve) => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true)
      resolve()
    }
    iframe.addEventListener("load", onload, true)
    cancellationToken.register(() => {
      iframe.removeEventListener("load", onload, true)
    })
  })
}

const performIframeAction = (iframe, action, args, { cancellationToken, compileServerOrigin }) => {
  jsenvLogger.debug(`> ${action}`, args)
  sendMessageToIframe(iframe, { action, args }, { compileServerOrigin })

  return new Promise((resolve, reject) => {
    const onMessage = (messageEvent) => {
      const { origin } = messageEvent
      if (origin !== compileServerOrigin) return
      const { data } = messageEvent
      if (typeof data !== "object" || data === null) return

      const { code, value } = data
      jsenvLogger.debug(`< ${code}`, value)
      if (code === `${action}-failure`) {
        window.removeEventListener("message", onMessage, false)
        reject(value)
      } else if (code === `${action}-completion`) {
        window.removeEventListener("message", onMessage, false)
        resolve(value)
      }
    }

    window.addEventListener("message", onMessage, false)
    cancellationToken.register(() => {
      window.removeEventListener("message", onMessage, false)
    })
  })
}

const sendMessageToIframe = (iframe, data, { compileServerOrigin }) => {
  iframe.contentWindow.postMessage(data, compileServerOrigin)
}
