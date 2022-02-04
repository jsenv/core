import { createEventSourceConnection } from "./event_source_connection.js"
import {
  isLivereloadEnabled,
  setLivereloadPreference,
} from "./livereload_preference.js"
import { createUrlContext } from "./url_context.js"
import { reloadPage } from "./reload.js"

const urlContext = createUrlContext()

const reloadMessages = []
const urlHotMetas = {}
const reloadMessagesSignal = { onchange: () => {} }
const applyReloadMessageEffects = async () => {
  const someEffectIsFullReload = reloadMessages.some(
    (reloadMessage) => reloadMessage.instruction.type === "full_reload",
  )
  if (someEffectIsFullReload) {
    reloadPage()
    return
  }
  const onApplied = (reloadMessage) => {
    const index = reloadMessages.indexOf(reloadMessage)
    reloadMessages.splice(index, 1)
    reloadMessagesSignal.onchange()
  }
  const setReloadMessagePromise = (reloadMessage, promise) => {
    reloadMessage.status = "pending"
    promise.then(
      () => {
        onApplied(reloadMessage)
      },
      (e) => {
        console.error(e)
        console.error(
          `[hmr] Failed to reload after ${reloadMessage.reason}.
This could be due to syntax errors or importing non-existent modules (see errors above)`,
        )
        reloadMessage.status = "failed"
        reloadMessagesSignal.onchange()
      },
    )
  }
  reloadMessages.forEach((reloadMessage) => {
    if (reloadMessage.instruction.type === "hot_reload") {
      setReloadMessagePromise(
        reloadMessage,
        applyHotReload(reloadMessage.instruction),
      )
      return
    }
    setReloadMessagePromise(reloadMessage, Promise.resolve())
  })
  reloadMessagesSignal.onchange() // reload status is "pending"
}

const applyHotReload = async ({ updates }) => {
  await updates.reduce(async (previous, { type, relativeUrl }) => {
    await previous
    const urlToFetch = urlContext.asUrlToFetch(relativeUrl)
    const urlHotMeta = urlHotMetas[urlToFetch]
    if (urlHotMeta && urlHotMeta.disposeCallback) {
      await urlHotMeta.disposeCallback()
    }
    // maybe rename "js" into "import"
    // "js" is too generic it could apply to a regular js file
    if (type === "js") {
      const urlWithHmr = injectQuery(urlToFetch, { hmr: Date.now() })
      const namespace = await import(urlWithHmr)
      console.log(`[jsenv] hot updated: ${relativeUrl}`)
      return namespace
    }
    throw new Error(`unknown update type: "${type}"`)
  }, Promise.resolve())
}

const injectQuery = (url, query) => {
  const urlObject = new URL(url)
  const { searchParams } = urlObject
  Object.keys(query).forEach((key) => {
    searchParams.set(key, query[key])
  })
  return String(urlObject)
}

const addReloadMessage = (reloadMessage) => {
  reloadMessages.push(reloadMessage)
  if (isLivereloadEnabled()) {
    applyReloadMessageEffects()
  } else {
    reloadMessagesSignal.onchange()
  }
}

const eventsourceConnection = createEventSourceConnection(
  document.location.href,
  {
    reload: ({ data }) => {
      const reloadMessage = JSON.parse(data)
      addReloadMessage(reloadMessage)
    },
  },
  {
    retryMaxAttempt: Infinity,
    retryAllocatedMs: 20 * 1000,
  },
)

const { status, connect, disconnect } = eventsourceConnection
connect()
window.__jsenv_event_source_client__ = {
  status,
  connect,
  disconnect,
  isLivereloadEnabled,
  setLivereloadPreference,
  urlHotMetas,
  reloadMessages,
  reloadMessagesSignal,
  applyReloadMessageEffects,
  addReloadMessage,
}

// const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }
