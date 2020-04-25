import { connectLivereloading } from "./livereloading.js"
import { applyStateIndicator, applyFileExecutionIndicator } from "./toolbar.js"
import { loadExploringConfig } from "./util.js"
import { jsenvLogger } from "./jsenvLogger.js"

const mainElement = document.querySelector("main")

export const onNavigateFileExecution = async (fileRelativeUrl) => {
  const pageContainer = document.createElement("div")

  const execute = async (fileRelativeUrl) => {
    applyFileExecutionIndicator("loading")
    const startTime = Date.now()

    pageContainer.innerHTML = ""
    const iframe = document.createElement("iframe")
    mainElement.appendChild(iframe)
    window.page.iframe = iframe

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

    window.page.status = "executing"
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
    window.page.status = "executed"
    if (executionResult.status === "errored") {
      // eslint-disable-next-line no-eval
      executionResult.error = window.eval(executionResult.exceptionSource)
      delete executionResult.exceptionSource
    }
    window.page.executionResult = executionResult

    const endTime = Date.now()
    const duration = endTime - startTime
    if (executionResult.status === "errored") {
      console.log(`error during execution`, executionResult.error)
      setTimeout(() => {
        applyFileExecutionIndicator("failure", duration)
      }, 2000)
    } else {
      console.log(`execution done`)
      setTimeout(() => {
        applyFileExecutionIndicator("success", duration)
      }, 2000)
    }
  }

  window.page = {
    status: "loading",
    evaluate: () => {
      throw new Error("cannot evaluate, page is not ready")
    },
    executionResult: undefined,
    execute,
    reload: () => execute(fileRelativeUrl),
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
    element: pageContainer,
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
