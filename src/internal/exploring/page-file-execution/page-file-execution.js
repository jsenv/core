import { isCancelError } from "@jsenv/cancellation"
import { memoize } from "../../memoize.js"
import { createLivereloading } from "../livereloading/livereloading.js"
import { applyLivereloadIndicator } from "../toolbar/livereload-indicator.js"
import { applyExecutionIndicator } from "../toolbar/execution-indicator.js"
import { loadExploringConfig, createPromiseAndHooks } from "../util/util.js"
import { jsenvLogger } from "../util/jsenvLogger.js"
import { notifyFileExecution } from "../util/notification.js"

export const fileExecutionRoute = {
  name: "file-execution",

  match: (url) => {
    return new URL(url).pathname !== "/"
  },

  enter: async ({ cancellationToken, destinationUrl }, router) => {
    const reload = () => {
      router.loadCurrentUrl()
    }

    let connectedOnce = false
    const firstConnectionPromise = createPromiseAndHooks()
    const fileRelativeUrl = new URL(destinationUrl).pathname.slice(1)

    // reset livereload indicator ui
    applyLivereloadIndicator()
    const livereloading = createLivereloading(fileRelativeUrl, {
      onFileChanged: () => {
        reload()
      },
      onFileRemoved: () => {
        reload()
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
        if (connectedOnce) {
          // we have lost connection to the server, we might have missed some file changes
          // let's re-execute the file
          reload()
        } else {
          connectedOnce = true
          firstConnectionPromise.resolve()
        }
      },
    })
    cancellationToken.register(() => {
      livereloading.disconnect()
    })

    if (livereloading.isEnabled()) {
      livereloading.connect()
    } else {
      applyLivereloadIndicator("off", { connect: livereloading.connect })
      connectedOnce = true
      firstConnectionPromise.resolve()
    }

    window.file = {
      previousExecution: undefined,
      execution: undefined,
      evaluate: () => {
        throw new Error("cannot evaluate, page is not ready")
      },
      // execute,
      // reload: () => execute(fileRelativeUrl),
    }
    cancellationToken.register(() => {
      window.file = undefined
    })

    let latestExecution

    return {
      title: fileRelativeUrl,
      load: async ({ loadCancellationToken }) => {
        const iframe = document.createElement("iframe")

        return {
          element: iframe,
          mutateElementBeforeDisplay: async () => {
            applyExecutionIndicator() // reset file execution indicator ui

            await firstConnectionPromise
            const pendingExecution = {
              fileRelativeUrl,
              status: null,
              iframe,
              startTime: null,
              endTime: null,
              result: null,
            }
            await loadAndExecute(pendingExecution, { cancellationToken: loadCancellationToken })

            const execution = pendingExecution
            const previousExecution = latestExecution
            latestExecution = execution
            window.file.previousExecution = previousExecution
            window.file.execution = execution

            const duration = execution.endTime - execution.startTime
            if (execution.result.status === "errored") {
              jsenvLogger.debug(`error during execution`, execution.result.error)
              applyExecutionIndicator("failure", duration)
            } else {
              applyExecutionIndicator("success", duration)
            }
            notifyFileExecution(execution, previousExecution)
          },
          onPageViewRemoved: () => {
            // be sure the iframe src is reset to avoid eventual memory leak
            // if it was unproperly garbage collected or something
            iframe.src = "about:blank"
          },
        }
      },
    }
  },
}

const loadAndExecute = async (execution, { cancellationToken }) => {
  try {
    return await performLoadAndExecute(execution, { cancellationToken })
  } catch (e) {
    if (isCancelError(e)) {
      return e
    }
    throw e
  }
}

const performLoadAndExecute = async (execution, { cancellationToken }) => {
  const startTime = Date.now()
  execution.startTime = startTime

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
  } = await loadExploringConfig({ cancellationToken })
  if (cancellationToken.cancellationRequested) {
    return
  }

  // memoize ensure iframe is lazyly loaded once
  const loadIframe = memoize(() => {
    const loadedPromise = iframeToLoaded(execution.iframe, {
      cancellationToken,
    })
    execution.iframe.src = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${execution.fileRelativeUrl}`
    return loadedPromise
  })

  const evaluate = async (fn, ...args) => {
    await loadIframe()
    args = [`(${fn.toString()})`, ...args]
    return performIframeAction(execution.iframe, "evaluate", args, {
      cancellationToken,
      compileServerOrigin,
    })
  }

  // executing means fetching, parsing, executing file imports + file itself
  execution.status = "executing"
  const executionResult = await evaluate(
    // disable coverage for this line because it will be executed
    // in an other context where the coverage global variable will not exists
    /* istanbul ignore next */
    (param) => {
      return window.execute(param)
    },
    {
      fileRelativeUrl: execution.fileRelativeUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      browserRuntimeFileRelativeUrl,
      sourcemapMainFileRelativeUrl,
      sourcemapMappingFileRelativeUrl,
      collectNamespace: true,
      transferableNamespace: true,
      collectCoverage: false,
      executionId: execution.fileRelativeUrl,
      errorExposureInConsole: true,
    },
  )
  execution.status = "executed"
  if (executionResult.status === "errored") {
    // eslint-disable-next-line no-eval
    executionResult.error = window.eval(executionResult.exceptionSource)
  }
  execution.result = executionResult
  const endTime = Date.now()
  execution.endTime = endTime
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
      if (data.action !== action) return

      const { state, value } = data
      jsenvLogger.debug(`< ${action} ${state}`, value)

      if (state === `failure`) {
        window.removeEventListener("message", onMessage, false)
        reject(value)
      } else if (state === `completion`) {
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
