import { memoize } from "../memoize.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"

const {
  iframe,
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

const renderExplorable = async () => {
  const response = await fetchUsingXHR(`${apiServerOrigin}/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
  })
  const files = await response.json()

  const ul = document.querySelector("ul")
  ul.innerHTML = files
    .map((file) => {
      return `<li><a href="/${file}">${file}</a></li>`
    })
    .join("")
}
renderExplorable()

const renderExecution = async () => {
  const fileRelativeUrl = document.location.pathname.slice(1)

  if (fileRelativeUrl) {
    document.title = `${fileRelativeUrl}`
  }

  await loadIframe()

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

window.onpopstate = () => {
  renderExecution()
}
renderExecution()
