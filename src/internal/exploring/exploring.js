import { memoize } from "../memoize.js"
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

  await loadIframe()

  // BEST SOLUTION:
  // change the iframe src to add template.html?file=fileRelativeUrl
  // then server can read request.origin to find out that file was requested by that iframe
  // and assume it's a dependency for this file execution
  // no need for x-jsenv-execution-id or stuff like that, rock solid

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

const connectExecutionEventSource = (fileRelativeUrl) => {
  const eventSourceUrl = `${apiServerOrigin}/${fileRelativeUrl}`
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
        // mais lui ne devrait reload que l'iframe
        // et puis si un fichier change mais qu'on se fout de ce fichier on veut pas reload l'iframe
        // je pense qu'on a besoin
        // document.location.reload()
      },
      "file-removed": ({ data }) => {
        logEventSource(`${data} removed -> reload iframe`)
        // same here reload only the iframe
        // document.location.reload()
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
        // lui restart toute la page c'est logique je dirais
        // au cas ou on est changé des params du serveur ?
        // a piori pas fou je pense qu'il faudrais plutot se connecter
        document.location.reload()
      }
    },
  )
}

const loadIframe = memoize(() => {
  return new Promise((resolve) => {
    iframe.addEventListener("load", resolve, true)
    iframe.src = `${compileServerOrigin}/${htmlFileRelativeUrl}`
  })
})

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
