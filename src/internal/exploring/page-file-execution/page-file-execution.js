import { memoize } from "../../memoize.js"
import { applyExecutionIndicator } from "../toolbar/execution-indicator.js"
import { waitLivereloadReady } from "../toolbar/toolbar-livereloading.js"
import { loadExploringConfig } from "../util/util.js"
import { jsenvLogger } from "../util/jsenvLogger.js"
import { notifyFileExecution } from "../util/notification.js"

export const fileExecutionRoute = {
  name: "file-execution",

  match: ({ url }) => new URL(url).pathname !== "/",

  activate: async ({ cancellationToken, url, activePage }) => {
    // await new Promise(() => {})
    window.file = {
      previousExecution: undefined,
      execution: undefined,
      evaluate: () => {
        throw new Error("cannot evaluate, page is not ready")
      },
      execute: () => {
        throw new Error("cannot execute, page is not ready")
      },
    }
    cancellationToken.register(({ reason }) => {
      if (!reason.activeService || reason.activeService !== fileExecutionRoute) {
        window.file = undefined
      }
    })

    const fileRelativeUrl = new URL(url).pathname.slice(1)
    const iframe = document.createElement("iframe")
    iframe.setAttribute("tabindex", -1) // prevent tabbing until loaded
    const page = {
      title: fileRelativeUrl,

      element: iframe,

      execution: undefined,

      prepareEntrance: async () => {
        applyExecutionIndicator() // reset file execution indicator ui

        const pendingExecution = {
          fileRelativeUrl,
          status: null,
          iframe,
          startTime: null,
          endTime: null,
          result: null,
        }
        await loadAndExecute(pendingExecution, {
          cancellationToken,
        })

        const execution = pendingExecution
        const previousExecution = activePage ? activePage.execution : undefined
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
        page.execution = execution
      },

      effect: () => {
        document.documentElement.setAttribute("data-page-execution", "")
        return () => {
          document.documentElement.removeAttribute("data-page-execution")
        }
      },

      onceleft: () => {
        // be sure the iframe src is reset to avoid eventual memory leak
        // if it was unproperly garbage collected or something
        iframe.src = "about:blank"
      },
    }

    return page
  },
}

const loadAndExecute = async (execution, { cancellationToken }) => {
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
  const loadIframe = memoize(async () => {
    const loadedPromise = iframeToLoaded(execution.iframe, {
      cancellationToken,
    })
    /**
    DON'T USE iframe.src it would create
    an entry in the browser history (firefox only)
    instead use iframe location replace which avoid creating a browser history
    */
    const { iframe } = execution
    const iframeSrc = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${execution.fileRelativeUrl}`
    // iframe.contentWindow.location.replace(iframeSrc)
    const { parentNode } = iframe
    parentNode.removeChild(iframe)
    iframe.setAttribute("src", iframeSrc)
    parentNode.appendChild(iframe)

    await loadedPromise
    iframe.removeAttribute("tabindex")

    return loadedPromise
  })

  const evaluate = async (fn, ...args) => {
    await waitLivereloadReady()
    await loadIframe()

    args = [`(${fn.toString()})`, ...args]
    return performIframeAction(execution.iframe, "evaluate", args, {
      cancellationToken,
      compileServerOrigin,
    })
  }
  window.file.evaluate = evaluate

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
