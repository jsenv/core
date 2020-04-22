import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { connectEventSource } from "./connectEventSource.js"

const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUsingXHR("/exploring.json", {
    headers: { "x-jsenv-exploring": "1" },
  })
  const exploringConfig = await exploringJsonResponse.json()
  return exploringConfig
}

const mainElement = document.querySelector("main")

const toggleTooltip = (name) => {
  document.querySelector(`.${name}`).classList.toggle("tooltipVisible")
}

const closeToolbar = () => {
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")
  document.documentElement.removeAttribute("data-toolbar-visible")
}

function resizeInput() {
  if (this.value.length > 40) {
    this.style.width = "40ch"
  } else {
    this.style.width = `${this.value.length}ch`
  }
}

const renderToolbar = (fileRelativeUrl) => {
  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = () => toggleTooltip("serverState")
    document.querySelector("#button-execution-indicator").onclick = () =>
      toggleTooltip("fileExecution")
    document.querySelector("#button-close-toolbar").onclick = closeToolbar

    document.querySelector("#button-state-indicator").style.display = ""
    document.querySelector(".fileName").value = fileRelativeUrl

    var input = document.querySelector("input") // get the input element
    resizeInput.call(input) // immediately call the function
  } else {
    document.querySelector("#button-state-indicator").style.display = "none"
  }
}

const handleLocation = () => {
  const fileRelativeUrl = document.location.pathname.slice(1)
  renderToolbar(fileRelativeUrl)

  if (fileRelativeUrl) {
    renderExecution(fileRelativeUrl)
  } else {
    renderConfigurationPage()
  }
}

const renderConfigurationPage = async () => {
  const { projectDirectoryUrl, explorableConfig } = await loadExploringConfig()

  document.title = `${projectDirectoryUrl}`
  // it would be great to have a loading step in the html display at this point
  mainElement.innerHTML = ""

  const configurationPageElement = document
    .querySelector(`[data-page="configuration"`)
    .cloneNode(true)

  // explorable section
  // const titleElement = configurationPageElement.querySelector("h2")
  // titleElement.innerHTML = projectDirectoryUrl

  const response = await fetchUsingXHR(`/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
    headers: {
      "x-jsenv-exploring": "1",
    },
  })
  const files = await response.json()

  const ul = configurationPageElement.querySelector("ul")
  ul.innerHTML = files.map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")

  // settings section
  const toolbarInput = configurationPageElement.querySelector("#toggle-toolbar")
  toolbarInput.onchange = () => {
    if (toolbarInput.checked) {
      document.documentElement.removeAttribute("data-toolbar-visible")
    } else {
      document.documentElement.setAttribute("data-toolbar-visible", "")
    }
  }

  mainElement.appendChild(configurationPageElement)
}

const renderExecution = async (fileRelativeUrl) => {
  document.title = `${fileRelativeUrl}`
  connectExecutionEventSource(fileRelativeUrl)
  execute(fileRelativeUrl)
}

const applyStateIndicator = (state, { abort, disconnect, reconnect }) => {
  const stateIndicator = document.getElementById("stateIndicatorCircle")
  const stateIndicatorRing = document.getElementById("stateIndicatorRing")
  const tooltiptext = document.querySelector(".tooltipTextServerState")
  const retryIcon = document.querySelector(".retryIcon")

  // remove all classes before applying the right ones
  stateIndicatorRing.classList.remove("loadingRing")
  stateIndicator.classList.remove("loadingCircle", "redCircle", "greenCircle")
  retryIcon.classList.remove("retryIconDisplayed")

  if (state === "loading") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = `Connecting to server... <a href="javascript:void(0);">cancel</a>`
    tooltiptext.querySelector("a").onclick = abort
  } else if (state === "success") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = `Connected to server <a href="javascript:void(0);">disconnect</a>`
    tooltiptext.querySelector("a").onclick = disconnect
  } else if (state === "failure") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = `Disconnected from server <a href="javascript:void(0);">reconnect</a>`
    tooltiptext.querySelector("a").onclick = reconnect
  }
}

const connectExecutionEventSource = (fileRelativeUrl) => {
  const eventSourceUrl = `${window.origin}/${fileRelativeUrl}`
  const logEventSource = (message) => {
    console.log(
      `%ceventSource%c ${message}`,
      `background: #ffdc00; color: black; padding: 1px 3px; margin: 0 1px`,
      "",
    )
  }

  connectEventSource(
    eventSourceUrl,
    {
      "file-changed": (event) => {
        logEventSource(`${event.data} changed -> reload iframe`)
        execute(fileRelativeUrl)
      },
      "file-removed": ({ data }) => {
        logEventSource(`${data} removed -> reload iframe`)
        execute(fileRelativeUrl)
      },
    },
    {
      CONNECTING: ({ abort }) => {
        logEventSource(`connecting to ${eventSourceUrl}`)
        applyStateIndicator("loading", { abort })
      },
      CONNECTION_FAILURE: ({ failureConsequence, failureReason, reconnect }) => {
        if (failureConsequence === "renouncing" && failureReason === "error") {
          logEventSource(`failed connection to ${eventSourceUrl}`)
        }
        if (failureConsequence === "renouncing" && failureReason === "script") {
          logEventSource(`aborted connection to ${eventSourceUrl}`)
        }
        if (failureConsequence === "disconnection") {
          logEventSource(`disconnected from ${eventSourceUrl}`)
        }
        // make ui indicate the failure providing a way to reconnect manually
        applyStateIndicator("failure", { reconnect })
      },
      CONNECTED: ({ reconnectionFlag, disconnect }) => {
        if (reconnectionFlag) {
          logEventSource(`reconnected to ${eventSourceUrl} -> reload iframe`)
          applyStateIndicator("success", { disconnect })
          // we have lost connection to the server, we might have missed some file changes
          // let's re-execute the file
          // TODO:
          // It might be unexpected for the user if we re-execute the file when nothing has changed
          // it might be better to show a message in the ui saying
          // "Hey connection to the server was lost, what you see might not be the latest change
          // consider re-executing the file to be sure you are seeing the latest changes"
          // with a button to re-execute the file and an other to discard this message
          execute(fileRelativeUrl)
        } else {
          logEventSource(`connected to ${eventSourceUrl}`)
          applyStateIndicator("success", { disconnect })
        }
      },
      reconnectionOnError: true,
      reconnectionAllocatedMs: 1000 * 30, // 30 seconds
      reconnectionInterval: 1000, // 1 second
      backgroundReconnection: true,
      backgroundReconnectionAllocatedMs: 1000 * 60 * 60 * 24, // 24 hours
      backgroundReconnectionInterval: 1000 * 60 * 5, // 5 minutes
    },
  )
}

const applyFileExecutionIndicator = (state, duration) => {
  const checkIcon = document.getElementById("checkIconSvg")
  const crossIcon = document.getElementById("failIconSvg")
  const loader = document.getElementById("loaderSvg")
  const tooltiptext = document.querySelector(".tooltipTextFileExecution")

  // remove all classes before applying the right ones
  checkIcon.classList.remove("animateCheck")
  crossIcon.classList.remove("animateCross")
  loader.classList.remove("animateLoader")

  if (state === "loading") {
    loader.classList.add("animateLoader")
    tooltiptext.innerHTML = "Executing..."
  } else if (state === "success") {
    checkIcon.classList.add("animateCheck")
    tooltiptext.innerHTML = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    crossIcon.classList.add("animateCross")
    tooltiptext.innerHTML = `Execution failed in ${duration}ms`
  }
}

const execute = async (fileRelativeUrl) => {
  const startTime = Date.now()
  applyFileExecutionIndicator("loading")

  mainElement.innerHTML = ``
  const iframe = document.createElement("iframe")
  mainElement.appendChild(iframe)

  const {
    compileServerOrigin,
    htmlFileRelativeUrl,
    outDirectoryRelativeUrl,
    browserRuntimeFileRelativeUrl,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
  } = await loadExploringConfig()

  const iframeSrc = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`

  await loadIframe(iframe, { iframeSrc })

  const result = await performIframeAction(
    iframe,
    "execute",
    [
      {
        fileRelativeUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
        browserRuntimeFileRelativeUrl,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl,
        collectNamespace: true,
        collectCoverage: false,
        executionId: fileRelativeUrl,
      },
    ],
    { compileServerOrigin },
  )
  const endTime = Date.now()
  const duration = endTime - startTime
  if (result.status === "errored") {
    // eslint-disable-next-line no-eval
    const error = window.eval(result.exceptionSource)
    console.log(`error during execution`, error)
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
  sendMessageToIframe(iframe, { action, args }, { compileServerOrigin })

  return new Promise((resolve, reject) => {
    const onMessage = (messageEvent) => {
      const { origin } = messageEvent
      if (origin !== compileServerOrigin) return
      const { data } = messageEvent
      if (typeof data !== "object" || data === null) return

      const { code, value } = data
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

window.onpopstate = () => {
  handleLocation()
}
handleLocation()

// handle data-last-interaction attr on body (focusring)
window.addEventListener("mousedown", (mousedownEvent) => {
  if (mousedownEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse")
})
window.addEventListener("touchstart", (touchstartEvent) => {
  if (touchstartEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse")
})
window.addEventListener("keydown", (keydownEvent) => {
  if (keydownEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "keyboard")
})
