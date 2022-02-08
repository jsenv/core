import { inferContextFrom, createUrlContext } from "../url_context.js"
import { createEventSourceConnection } from "./event_source_connection.js"
import {
  isAutoreloadEnabled,
  setAutoreloadPreference,
} from "./autoreload_preference.js"
import { compareTwoUrlPaths } from "./url_helpers.js"
import {
  reloadHtmlPage,
  reloadDOMNodesUsingUrls,
  reloadJsImport,
} from "./reload.js"
import { urlHotMetas } from "./import_meta_hot_module.js"

const urlContext = createUrlContext(
  inferContextFrom({
    url: window.location,
  }),
)

const reloadMessages = []
const reloadMessagesSignal = { onchange: () => {} }
const applyReloadMessageEffects = async () => {
  const someEffectIsFullReload = reloadMessages.some(
    (reloadMessage) => reloadMessage.instruction.type === "full_reload",
  )
  if (someEffectIsFullReload) {
    reloadHtmlPage()
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
  await updates.reduce(
    async (previous, { type, relativeUrl, acceptedByRelativeUrl }) => {
      await previous

      const urlToFetch = urlContext.asUrlToFetch(relativeUrl)
      const urlHotMeta = urlHotMetas[urlToFetch]
      if (urlHotMeta && urlHotMeta.disposeCallback) {
        await urlHotMeta.disposeCallback()
      }
      if (type === "js_module") {
        const namespace = await reloadJsImport(urlToFetch)
        console.log(`[jsenv] hot updated: ${relativeUrl}`)
        return namespace
      }
      if (type === "html") {
        if (!compareTwoUrlPaths(urlToFetch, window.location.href)) {
          // we are not in that HTML page
          return null
        }
        const urlToReload = urlContext.asUrlToFetch(acceptedByRelativeUrl)
        const sourceUrlToReload = urlContext.asSourceUrl(acceptedByRelativeUrl)
        reloadDOMNodesUsingUrls([urlToReload, sourceUrlToReload])
        console.log(`[jsenv] hot updated: ${relativeUrl}`)
        return null
      }
      throw new Error(`unknown update type: "${type}"`)
    },
    Promise.resolve(),
  )
}

const addReloadMessage = (reloadMessage) => {
  reloadMessages.push(reloadMessage)
  if (isAutoreloadEnabled()) {
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
  isAutoreloadEnabled,
  setAutoreloadPreference,
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
