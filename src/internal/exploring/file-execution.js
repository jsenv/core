import { connectLivereloading } from "./livereloading.js"
import { applyStateIndicator, applyFileExecutionIndicator } from "./toolbar.js"
import { loadExploringConfig } from "./util.js"
import { jsenvLogger } from "./jsenvLogger.js"

export const onNavigateFileExecution = async ({ pageContainer, fileRelativeUrl }) => {
  window.page = {
    previousExecution: undefined,
    execution: undefined,
    evaluate: () => {
      throw new Error("cannot evaluate, page is not ready")
    },
    execute,
    reload: () => execute(fileRelativeUrl),
  }

  const execute = async (fileRelativeUrl) => {
    const startTime = Date.now()
    const iframe = document.createElement("iframe")
    const execution = {
      status: "loading", // iframe loading
      iframe,
      startTime,
      endTime: null,
      result: null,
    }
    window.page.execution = execution

    applyFileExecutionIndicator("loading")
    if (window.page.previousExecution) {
      pageContainer.replaceChild(iframe, window.page.previousExecution.iframe)
    } else {
      pageContainer.appendChild(iframe)
    }

    const {
      compileServerOrigin,
      htmlFileRelativeUrl,
      outDirectoryRelativeUrl,
      browserRuntimeFileRelativeUrl,
      sourcemapMainFileRelativeUrl,
      sourcemapMappingFileRelativeUrl,
    } = await loadExploringConfig()

    const iframeSrc = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`
    const iframePromise = loadIframe(iframe, { iframeSrc })

    const evaluate = async (fn, ...args) => {
      await iframePromise
      args = [`(${fn.toString()})`, ...args]
      return performIframeAction(iframe, "evaluate", args, {
        compileServerOrigin,
      })
    }
    window.page.evaluate = evaluate

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
    })
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
      jsenvLogger.log(`error during execution`, executionResult.error)
      applyFileExecutionIndicator("failure", duration)
    } else {
      applyFileExecutionIndicator("success", duration)
    }

    window.page.previousExecution = execution
  }

  const connecting = connectLivereloading(fileRelativeUrl, {
    onFileChanged: () => {
      execute(fileRelativeUrl)
    },
    onFileRemoved: () => {
      execute(fileRelativeUrl)
    },
    onConnecting: ({ abort }) => {
      applyStateIndicator("connecting", { abort })
    },
    onAborted: ({ connect }) => {
      applyStateIndicator("off", { connect })
    },
    onConnectionFailed: ({ reconnect }) => {
      // make ui indicate the failure providing a way to reconnect manually
      applyStateIndicator("disconnected", { reconnect })
    },
    onConnected: ({ disconnect }) => {
      applyStateIndicator("connected", { disconnect })
      // we have lost connection to the server, we might have missed some file changes
      // let's re-execute the file
      execute(fileRelativeUrl)
    },
  })
  // if not connecting we don't wait for connection to be established before executing
  // we execute immediatly (happen when livereloading is disabled)
  if (!connecting) {
    execute(fileRelativeUrl)
  }

  return {
    title: fileRelativeUrl,
    onleave: () => {
      window.page = undefined
    },
  }
}

const loadIframe = (iframe, { iframeSrc }) => {
  return new Promise((resolve) => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true)
      resolve()
    }
    iframe.addEventListener("load", onload, true)
    iframe.src = iframeSrc
  })
}

const performIframeAction = (iframe, action, args, { compileServerOrigin }) => {
  jsenvLogger.log(`> ${action}`, args)
  sendMessageToIframe(iframe, { action, args }, { compileServerOrigin })

  return new Promise((resolve, reject) => {
    const onMessage = (messageEvent) => {
      const { origin } = messageEvent
      if (origin !== compileServerOrigin) return
      const { data } = messageEvent
      if (typeof data !== "object" || data === null) return

      const { code, value } = data
      jsenvLogger.log(`< ${code}`, value)
      if (code === `${action}-failure`) {
        window.removeEventListener("message", onMessage, false)
        reject(value)
      } else if (code === `${action}-completion`) {
        window.removeEventListener("message", onMessage, false)
        resolve(value)
      }
    }

    window.addEventListener("message", onMessage, false)
  })
}

const sendMessageToIframe = (iframe, data, { compileServerOrigin }) => {
  iframe.contentWindow.postMessage(data, compileServerOrigin)
}
