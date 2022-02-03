/* eslint-env browser */

import { createEventSourceConnection } from "./event_source_connection.js"
import {
  isLivereloadEnabled,
  setLivereloadPreference,
} from "./livereload_preference.js"
import { reloadPage } from "./reload.js"

const serverUpdates = []
const urlHotMetas = {}
const serverUpdatesSignal = { onchange: () => {} }
const handleServerUpdateMessage = (serverUpdate) => {
  serverUpdates.push(serverUpdate)
  serverUpdate.effect = getServerUpdateEffect(serverUpdate)
  if (isLivereloadEnabled()) {
    applyServerUpdates()
  } else {
    serverUpdatesSignal.onchange()
  }
}
const applyServerUpdates = async (serverUpdates) => {
  const someEffectIsFullReload = serverUpdates.find(
    (update) => update.effect.type === "full_reload",
  )
  if (someEffectIsFullReload) {
    reloadPage()
    return
  }
  const copy = serverUpdates.slice()
  serverUpdates.length = 0
  copy.forEach((update) => {
    update.effect()
  })
}

const getServerUpdateEffect = ({ type, payload }) => {
  if (
    type === "file_added" ||
    type === "file_modified" ||
    type === "file_removed"
  ) {
    const fileRelativeUrl = payload.fileRelativeUrl
    const hotMetaUrl = findHotMetaUrl(fileRelativeUrl)
    const urlHotMeta = urlHotMetas[hotMetaUrl]
    if (urlHotMeta) {
      if (urlHotMeta === "decline" || urlHotMeta === "invalidate") {
        return {
          type: "full_reload",
          reason: `${payload.fileRelativeUrl} update`,
        }
      }
      return {
        type: "hot_reload",
        reason: `${payload.fileRelativeUrl} update`,
        effect: () => {
          urlHotMeta.hotCallback()
        },
      }
    }
    return {
      type: "full_reload",
      reason: `${payload.fileRelativeUrl} update`,
    }
  }
  return null
}

const findHotMetaUrl = (originalFileRelativeUrl) => {
  return Object.keys(urlHotMetas).find((compileUrl) => {
    return (
      parseCompiledUrl(compileUrl).fileRelativeUrl === originalFileRelativeUrl
    )
  })
}

// TODO: the following "parseCompiledUrl"
// already exists somewhere in the codebase: reuse the other one
const parseCompiledUrl = (url) => {
  const { pathname, search } = new URL(url)
  const ressource = `${pathname}${search}`
  const slashIndex = ressource.indexOf("/", 1)
  const compileDirectoryRelativeUrl = ressource.slice(1, slashIndex)
  const afterCompileDirectory = ressource.slice(slashIndex)
  const nextSlashIndex = afterCompileDirectory.indexOf("/")
  const compileId = afterCompileDirectory.slice(0, nextSlashIndex)
  const afterCompileId = afterCompileDirectory.slice(nextSlashIndex)
  return {
    compileDirectoryRelativeUrl,
    compileId,
    fileRelativeUrl: afterCompileId,
  }
}

const eventsourceConnection = createEventSourceConnection(
  document.location.href,
  {
    "file-added": ({ data }) => {
      handleServerUpdateMessage({
        type: "file_added",
        payload: { fileRelativeUrl: data },
      })
    },
    "file-modified": ({ data }) => {
      handleServerUpdateMessage({
        type: "file_modified",
        payload: { fileRelativeUrl: data },
      })
    },
    "file-removed": ({ data }) => {
      handleServerUpdateMessage({
        type: "file_removed",
        payload: { fileRelativeUrl: data },
      })
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
  serverUpdates,
  serverUpdatesSignal,
}
