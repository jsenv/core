import { urlHotMetas } from "../../import_meta_hot/client/import_meta_hot.js"
import {
  isAutoreloadEnabled,
  setAutoreloadPreference,
} from "./autoreload_preference.js"
import { compareTwoUrlPaths } from "./url_helpers.js"
import {
  reloadHtmlPage,
  reloadJsImport,
  getDOMNodesUsingUrl,
} from "./reload.js"

const reloader = {
  urlHotMetas,
  isAutoreloadEnabled,
  setAutoreloadPreference,
  status: "idle",
  currentExecution: null,
  onstatuschange: () => {},
  setStatus: (status) => {
    reloader.status = status
    reloader.onstatuschange()
  },
  messages: [],
  addMessage: (reloadMessage) => {
    reloader.messages.push(reloadMessage)
    if (isAutoreloadEnabled()) {
      reloader.reload()
    } else {
      reloader.setStatus("can_reload")
    }
  },
  reload: () => {
    const someEffectIsFullReload = reloader.messages.some(
      (reloadMessage) => reloadMessage.type === "full",
    )
    if (someEffectIsFullReload) {
      reloadHtmlPage()
      return
    }
    reloader.setStatus("reloading")
    const onApplied = (reloadMessage) => {
      const index = reloader.messages.indexOf(reloadMessage)
      reloader.messages.splice(index, 1)
      if (reloader.messages.length === 0) {
        reloader.setStatus("idle")
      }
    }
    const setReloadMessagePromise = (reloadMessage, promise) => {
      promise.then(
        () => {
          onApplied(reloadMessage)
          reloader.currentExecution = null
        },
        (e) => {
          reloader.setStatus("failed")
          if (typeof window.reportError === "function") {
            window.reportError(e)
          } else {
            console.error(e)
          }
          console.error(
            `[jsenv] Hot reload failed after ${reloadMessage.reason}.
This could be due to syntax errors or importing non-existent modules (see errors in console)`,
          )
          reloader.currentExecution = null
        },
      )
    }
    reloader.messages.forEach((reloadMessage) => {
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
      // there is no url hot meta when:
      // - code was not executed (code splitting with dynamic import)
      // - import.meta.hot.accept() is not called (happens for HTML and CSS)

      if (type === "prune") {
        if (urlHotMeta) {
          delete urlHotMetas[urlToFetch]
          if (urlHotMeta.disposeCallback) {
            console.groupCollapsed(
              `[jsenv] cleanup ${boundary} (previously used in ${acceptedBy})`,
            )
            console.log(`call dispose callback`)
            await urlHotMeta.disposeCallback()
            console.groupEnd()
          }
        }
        return null
      }

      if (acceptedBy === boundary) {
        console.groupCollapsed(`[jsenv] hot reloading ${boundary}`)
      } else {
        console.groupCollapsed(
          `[jsenv] hot reloading ${acceptedBy} usage in ${boundary}`,
        )
      }
      if (type === "js_module") {
        if (!urlHotMeta) {
          // code was not executed, no need to re-execute it
          return null
        }
        if (urlHotMeta.disposeCallback) {
          console.log(`call dispose callback`)
          await urlHotMeta.disposeCallback()
        }
        console.log(`importing js module`)
        reloader.currentExecution = {
          type: "dynamic_import",
          url: urlToFetch,
        }
        const namespace = await reloadJsImport(urlToFetch)
        if (urlHotMeta.acceptCallback) {
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
        const urlToReload = new URL(acceptedBy, `${window.location.origin}/`)
          .href
        const domNodesUsingUrl = getDOMNodesUsingUrl(urlToReload)
        const domNodesCount = domNodesUsingUrl.length
        if (domNodesCount === 0) {
          console.log(`no dom node using ${acceptedBy}`)
        } else if (domNodesCount === 1) {
          console.log(`reloading`, domNodesUsingUrl[0].node)
          domNodesUsingUrl[0].reload()
        } else {
          console.log(`reloading ${domNodesCount} nodes using ${acceptedBy}`)
          domNodesUsingUrl.forEach((domNodesUsingUrl) => {
            domNodesUsingUrl.reload()
          })
        }
        console.groupEnd()
        return null
      }
      console.warn(`unknown update type: "${type}"`)
      return null
    },
    Promise.resolve(),
  )
}

window.__reloader__ = reloader
window.__server_events__.listenEvents({
  reload: (reloadServerEvent) => {
    reloader.addMessage(reloadServerEvent.data)
  },
})

// const findHotMetaUrl = (originalFileRelativeUrl) => {
//   return Object.keys(urlHotMetas).find((compileUrl) => {
//     return (
//       parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
//     )
//   })
// }
