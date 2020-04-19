import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { connectEventSource } from "./connectEventSource.js"

const {
  iframe,

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

const handleLocation = () => {
  const fileRelativeUrl = document.location.pathname.slice(1)
  if (fileRelativeUrl) {
    renderExecution(fileRelativeUrl)
  } else {
    renderIndex()
  }
}

const renderExecution = async (fileRelativeUrl) => {
  document.title = `${fileRelativeUrl}`

  connectExecutionEventSource(fileRelativeUrl)
  execute(fileRelativeUrl)
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
        console.log(event)
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
      } else if (connectionEvent === "failed") {
        logEventSource(`failed to connect to ${eventSourceUrl}`)
      } else if (connectionEvent === "connected") {
        logEventSource(`connected to ${eventSourceUrl}`)
      } else if (connectionEvent === "disconnected") {
        logEventSource(`disconnected from ${eventSourceUrl}`)
      } else if (connectionEvent === "reconnecting") {
        logEventSource(`connecting to ${eventSourceUrl}`)
      } else if (connectionEvent === "reconnected") {
        logEventSource(`reconnected to ${eventSourceUrl} -> reload page`)
        // need full reload (especially in case the server ports have changed)
        document.location.reload()
      }
    },
  )
}

const execute = async (fileRelativeUrl) => {
  await loadIframe(fileRelativeUrl)

  const result = await performIframeAction("execute", {
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
}

const loadIframe = (fileRelativeUrl) => {
  return new Promise((resolve) => {
    const onload = () => {
      iframe.removeEventListener("load", onload, true)
      resolve()
    }
    iframe.addEventListener("load", onload, true)
    iframe.src = `${compileServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`
  })
}

const performIframeAction = (action, ...args) => {
  sendMessage({ action, args })

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

const sendMessage = (data) => {
  console.log(">", data)
  iframe.contentWindow.postMessage(data, compileServerOrigin)
}

const renderIndex = async () => {
  document.title = `${projectDirectoryUrl}`
  document.querySelector("h1").innerHTML = projectDirectoryUrl

  const response = await fetchUsingXHR(`${apiServerOrigin}/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
  })
  const files = await response.json()

  const ul = document.querySelector("ul")
  ul.innerHTML = files.map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")
}

window.onpopstate = () => {
  handleLocation()
}
handleLocation()
