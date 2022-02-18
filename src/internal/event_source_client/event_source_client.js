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
    (reloadMessage) => reloadMessage.type === "full",
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
        // reuse error display from html supervisor?
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
    if (reloadMessage.type === "hot") {
      setReloadMessagePromise(reloadMessage, applyHotReload(reloadMessage))
      return
    }
    setReloadMessagePromise(reloadMessage, Promise.resolve())
  })
  reloadMessagesSignal.onchange() // reload status is "pending"
}

const applyHotReload = async ({ hotInstructions }) => {
  await hotInstructions.reduce(
    async (previous, { type, boundary, acceptedBy }) => {
      await previous

      const urlToFetch = urlContext.asUrlToFetch(boundary)
      const urlHotMeta = urlHotMetas[urlToFetch]
      if (urlHotMeta && urlHotMeta.disposeCallback) {
        await urlHotMeta.disposeCallback()
      }
      if (type === "prune") {
        console.log(`[jsenv] hot prune: ${boundary}`)
        return null
      }
      if (type === "js_module") {
        const namespace = await reloadJsImport(urlToFetch)
        console.log(`[jsenv] hot updated: ${boundary}`)
        return namespace
      }
      if (type === "html") {
        if (!compareTwoUrlPaths(urlToFetch, window.location.href)) {
          // we are not in that HTML page
          return null
        }
        const urlToReload = urlContext.asUrlToFetch(acceptedBy)
        const sourceUrlToReload = urlContext.asSourceUrl(acceptedBy)
        reloadDOMNodesUsingUrls([urlToReload, sourceUrlToReload])
        console.log(`[jsenv] hot updated: ${boundary}`)
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
