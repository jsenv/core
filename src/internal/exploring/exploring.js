import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { connectEventSource } from "./connectEventSource.js"

const {
  mainElement,
  toolbarElement,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  htmlFileRelativeUrl,
  browserRuntimeFileRelativeUrl,
  sourcemapMainFileRelativeUrl,
  sourcemapMappingFileRelativeUrl,

  apiServerOrigin,
  explorableConfig,
} = window.jsenv

/*
TODOLIST:

- faire un certificat https avec un custom authority qu'on trust et voir si ça fix les soucis sour chrome

*/

const toggleTooltip = () => {
  document.querySelector(".tooltip").classList.toggle("tooltipVisible")
}

const closeToolbar = () => {
  toolbarElement.setAttribute("data-visible", "")
}

const renderToolbar = (fileRelativeUrl) => {
  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = toggleTooltip
    document.querySelector("#button-close-toolbar").onclick = closeToolbar

    document.querySelector("#button-state-indicator").style.display = ""
    document.querySelector(".fileName").innerHTML = fileRelativeUrl
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
  document.title = `${projectDirectoryUrl}`
  // it would be great to have a loading step in the html display at this point
  mainElement.innerHTML = ""

  const configurationPageElement = document
    .querySelector(`[data-page="configuration"`)
    .cloneNode(true)

  // explorable section
  // const titleElement = configurationPageElement.querySelector("h2")
  // titleElement.innerHTML = projectDirectoryUrl

  const response = await fetchUsingXHR(`${apiServerOrigin}/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
  })
  const files = await response.json()

  const ul = configurationPageElement.querySelector("ul")
  ul.innerHTML = files.map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")

  // settings section
  const toolbarInput = configurationPageElement.querySelector("#toggle-toolbar")
  toolbarInput.onchange = () => {
    if (toolbarInput.checked) {
      toolbarElement.setAttribute("data-visible", "")
    } else {
      toolbarElement.removeAttribute("data-visible")
    }
  }

  mainElement.appendChild(configurationPageElement)
}

const renderExecution = async (fileRelativeUrl) => {
  document.title = `${fileRelativeUrl}`
  connectExecutionEventSource(fileRelativeUrl)
  execute(fileRelativeUrl)
}

const applyStateIndicator = (state) => {
  const stateIndicator = document.getElementById("stateIndicatorCircle")
  const stateIndicatorRing = document.getElementById("stateIndicatorRing")
  const tooltiptext = document.querySelector(".tooltiptext")
  const retryIcon = document.querySelector(".retryIcon")

  // remove all classes before applying the right ones
  stateIndicatorRing.classList.remove("loadingRing")
  stateIndicator.classList.remove("loadingCircle", "redCircle", "greenCircle")
  retryIcon.classList.remove("retryIconDisplayed")
  tooltiptext.classList.remove("tooltiptextMoved")

  if (state === "loading") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = "Connecting to server..."
  } else if (state === "success") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = "Server online"
  } else if (state === "failure") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = "Server offline"
    tooltiptext.classList.add("tooltiptextMoved")
    retryIcon.classList.add("retryIconDisplayed")
    retryIcon.onclick = () => document.location.reload()
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

  return connectEventSource(
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
    (connectionEvent) => {
      if (connectionEvent === "connecting") {
        logEventSource(`connecting to ${eventSourceUrl}`)
        applyStateIndicator("loading")
      } else if (connectionEvent === "failed") {
        logEventSource(`failed to connect to ${eventSourceUrl}`)
        applyStateIndicator("failure")
      } else if (connectionEvent === "connected") {
        logEventSource(`connected to ${eventSourceUrl}`)
        applyStateIndicator("success")
      } else if (connectionEvent === "disconnected") {
        logEventSource(`disconnected from ${eventSourceUrl}`)
        applyStateIndicator("failure")
      } else if (connectionEvent === "reconnecting") {
        logEventSource(`connecting to ${eventSourceUrl}`)
        applyStateIndicator("loading")
      } else if (connectionEvent === "reconnected") {
        logEventSource(`reconnected to ${eventSourceUrl} -> reload page`)
        applyStateIndicator("success")
        // need full reload (especially in case the server ports have changed)
        document.location.reload()
      }
    },
  )
}

const execute = async (fileRelativeUrl) => {
  document.getElementById("checkIconSvg").classList.remove("animateCheck")
  document.getElementById("loaderSvg").classList.add("animateLoader")

  mainElement.innerHTML = ``
  const iframe = document.createElement("iframe")
  mainElement.appendChild(iframe)

  const iframeSrc = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`

  await loadIframe(iframe, { iframeSrc })

  const result = await performIframeAction(iframe, "execute", {
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
  if (result.status === "errored") {
    // eslint-disable-next-line no-eval
    const error = window.eval(result.exceptionSource)
    console.log(`error during execution`, error)
  } else {
    console.log(`execution done`)
  }
  setTimeout(() => {
    document.getElementById("loaderSvg").classList.remove("animateLoader")
    document.getElementById("checkIconSvg").classList.add("animateCheck")
  }, 2000)
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

const performIframeAction = (iframe, action, ...args) => {
  sendMessageToIframe(iframe, { action, args })

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

const sendMessageToIframe = (iframe, data) => {
  iframe.contentWindow.postMessage(data, compileServerOrigin)
}

window.onpopstate = () => {
  handleLocation()
}
handleLocation()
