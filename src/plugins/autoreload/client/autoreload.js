import { urlHotMetas } from "../../import_meta_hot/client/import_meta_hot.js"
import {
  isAutoreloadEnabled,
  setAutoreloadPreference,
} from "./autoreload_preference.js"
import { compareTwoUrlPaths } from "./url_helpers.js"
import {
  reloadHtmlPage,
  reloadDOMNodesUsingUrl,
  reloadJsImport,
} from "./reload.js"

const autoreload = {
  urlHotMetas,
  isAutoreloadEnabled,
  setAutoreloadPreference,
  status: "idle",
  onstatuschange: () => {},
  setStatus: (status) => {
    autoreload.status = status
    autoreload.onstatuschange()
  },
  messages: [],
  addMessage: (reloadMessage) => {
    autoreload.messages.push(reloadMessage)
    if (isAutoreloadEnabled()) {
      autoreload.reload()
    } else {
      autoreload.setStatus("can_reload")
    }
  },
  reload: () => {
    const someEffectIsFullReload = autoreload.messages.some(
      (reloadMessage) => reloadMessage.type === "full",
    )
    if (someEffectIsFullReload) {
      reloadHtmlPage()
      return
    }

    autoreload.setStatus("autoreload")
    const onApplied = (reloadMessage) => {
      const index = autoreload.messages.indexOf(reloadMessage)
      autoreload.messages.splice(index, 1)
      if (autoreload.messages.length === 0) {
        autoreload.setStatus("idle")
      }
    }
    const setReloadMessagePromise = (reloadMessage, promise) => {
      promise.then(
        () => {
          onApplied(reloadMessage)
        },
        (e) => {
          autoreload.setStatus("failed")
          if (typeof window.reportError === "function") {
            window.reportError(e)
          } else {
            console.error(e)
          }
          console.error(
            `[jsenv] Hot reload failed after ${reloadMessage.reason}.
This could be due to syntax errors or importing non-existent modules (see errors in console)`,
          )
        },
      )
    }
    autoreload.messages.forEach((reloadMessage) => {
      if (reloadMessage.type === "hot") {
        const promise = addToHotQueue(() => {
          return applyHotReload(reloadMessage)
        })
        setReloadMessagePromise(reloadMessage, promise)
      } else {
        setReloadMessagePromise(reloadMessage, Promise.resolve())
      }
    })
  },
}

let pendingCallbacks = []
let running = false
const addToHotQueue = async (callback) => {
  pendingCallbacks.push(callback)
  dequeue()
}
const dequeue = async () => {
  if (running) {
    return
  }
  const callbacks = pendingCallbacks.slice()
  pendingCallbacks = []
  running = true
  try {
    await callbacks.reduce(async (previous, callback) => {
      await previous
      await callback()
    }, Promise.resolve())
  } finally {
    running = false
    if (pendingCallbacks.length) {
      dequeue()
    }
  }
}

const applyHotReload = async ({ hotInstructions }) => {
  await hotInstructions.reduce(
    async (previous, { type, boundary, acceptedBy }) => {
      await previous

      const urlToFetch = new URL(boundary, `${window.location.origin}/`).href
      const urlHotMeta = urlHotMetas[urlToFetch]
      // TODO: we should return when there is no url hot meta because
      // it means code was not executed (code splitting with dynamic import)
      // if (!urlHotMeta) {return }

      if (type === "prune") {
        console.groupCollapsed(
          `[jsenv] prune: ${boundary} (inside ${acceptedBy})`,
        )
      } else if (acceptedBy === boundary) {
        console.groupCollapsed(`[jsenv] hot reloading: ${boundary}`)
      } else {
        console.groupCollapsed(
          `[jsenv] hot reloading: ${acceptedBy} inside ${boundary}`,
        )
      }
      if (urlHotMeta && urlHotMeta.disposeCallback) {
        console.log(`call dispose callback`)
        await urlHotMeta.disposeCallback()
      }
      if (type === "prune") {
        delete urlHotMetas[urlToFetch]
        console.log(`cleanup pruned url`)
        console.groupEnd()
        return null
      }
      if (type === "js_module") {
        console.log(`importing js module`)
        const namespace = await reloadJsImport(urlToFetch)
        if (urlHotMeta && urlHotMeta.acceptCallback) {
          await urlHotMeta.acceptCallback(namespace)
        }
        console.log(`js module import done`)
        console.groupEnd()
        return namespace
      }
      if (type === "html") {
        if (!compareTwoUrlPaths(urlToFetch, window.location.href)) {
          // we are not in that HTML page
          return null
        }
        console.log(`reloading url`)
        const urlToReload = new URL(acceptedBy, `${window.location.origin}/`)
          .href
        reloadDOMNodesUsingUrl(urlToReload)
        console.log(`url reloaded`)
        console.groupEnd()
        return null
      }
      console.warn(`unknown update type: "${type}"`)
      return null
    },
    Promise.resolve(),
  )
}

window.__autoreload__ = autoreload
window.__server_events__.addEventCallbacks({
  reload: ({ data }) => {
    const reloadMessage = JSON.parse(data)
    autoreload.addMessage(reloadMessage)
  },
})

// const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }
