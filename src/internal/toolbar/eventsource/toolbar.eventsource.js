import { removeForceHideElement } from "../util/dom.js"
import { createPromiseAndHooks } from "../util/util.js"
import { createPreference } from "../util/preferences.js"
import { enableVariant } from "../variant/variant.js"

import { toggleTooltip, removeAutoShowTooltip, autoShowTooltip } from "../tooltip/tooltip.js"
import { connectCompileServerEventSource } from "./connectCompileServerEventSource.js"

const livereloadingPreference = createPreference("livereloading")

export const initToolbarEventSource = ({ executedFileRelativeUrl }) => {
  removeForceHideElement(document.querySelector("#eventsource-indicator"))
  connectEventSource(executedFileRelativeUrl)

  const livereloadCheckbox = document.querySelector("#toggle-livereload")
  livereloadCheckbox.checked = getLivereloadingPreference()
  livereloadCheckbox.onchange = () => {
    livereloadingPreference.set(livereloadCheckbox.checked)
    updateEventSourceIndicator()
  }
  updateEventSourceIndicator()
}

const parentEventSource = window.parent.__jsenv_eventsource__()
const latestChangeMap = parentEventSource.latestChangeMap
let eventSourceState = "default"
let eventSourceHooks = {}
let eventSourceConnection
let connectionReadyPromise

const handleFileChange = (file, type) => {
  latestChangeMap[file] = type
  updateEventSourceIndicator()
  const livereloadingEnabled = getLivereloadingPreference()
  if (livereloadingEnabled) {
    if (file.endsWith(".css")) {
      reloadAllCss()
      delete latestChangeMap[file]
      updateEventSourceIndicator()
    } else {
      reloadPage()
    }
  }
}

const reloadAllCss = () => {
  const links = Array.from(window.parent.document.getElementsByTagName("link"))
  links.forEach((link) => {
    if (link.rel === "stylesheet") {
      const url = new URL(link.href)
      url.searchParams.set("t", Date.now())
      link.href = String(url)
    }
  })
}

const reloadPage = () => {
  window.parent.location.reload(true)
}

const reloadChanges = () => {
  const fullReloadRequired = Object.keys(latestChangeMap).some((key) => !key.endsWith(".css"))
  if (fullReloadRequired) {
    reloadPage()
    return
  }
  const cssReloadRequired = Object.keys(latestChangeMap).some((key) => key.endsWith(".css"))
  if (cssReloadRequired) {
    reloadAllCss()
    Object.keys(latestChangeMap).forEach((key) => {
      if (key.endsWith(".css")) {
        delete latestChangeMap[key]
      }
      updateEventSourceIndicator()
    })
  }
}

const connectEventSource = (executedFileRelativeUrl) => {
  updateEventSourceIndicator()
  connectionReadyPromise = createPromiseAndHooks()

  eventSourceConnection = connectCompileServerEventSource(executedFileRelativeUrl, {
    onFileModified: (file) => {
      handleFileChange(file, "modified")
    },
    onFileRemoved: (file) => {
      handleFileChange(file, "removed")
    },
    onFileAdded: (file) => {
      handleFileChange(file, "added")
    },
    onConnecting: ({ cancel }) => {
      eventSourceState = "connecting"
      eventSourceHooks = { abort: cancel }
      updateEventSourceIndicator()
    },
    onConnectionCancelled: ({ connect }) => {
      eventSourceState = "disabled"
      eventSourceHooks = { connect }
      updateEventSourceIndicator()
    },
    onConnectionFailed: ({ connect }) => {
      eventSourceState = "failed"
      eventSourceHooks = { reconnect: connect }
      updateEventSourceIndicator()
    },
    onConnected: ({ cancel }) => {
      eventSourceState = "connected"
      eventSourceHooks = { disconnect: cancel }
      updateEventSourceIndicator()
      connectionReadyPromise.resolve()
      parentEventSource.disconnect()
    },
    lastEventId: parentEventSource.lastEventId,
  })

  eventSourceConnection.connect()
}

const getLivereloadingPreference = () => {
  return livereloadingPreference.has() ? livereloadingPreference.get() : true
}

export const disconnectEventSource = () => {
  if (eventSourceConnection) {
    eventSourceConnection.disconnect()
    eventSourceConnection = undefined
  }
}

export const waitEventSourceReady = () => connectionReadyPromise

const updateEventSourceIndicator = () => {
  const { connect, abort, reconnect } = eventSourceHooks

  const eventSourceIndicator = document.querySelector("#eventsource-indicator")
  const changeCount = Object.keys(latestChangeMap).length
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceState,
    livereload: getLivereloadingPreference() ? "on" : "off",
    changes: changeCount > 0 ? "yes" : "no",
  })

  const variantNode = document.querySelector("#eventsource-indicator > [data-when-active]")
  variantNode.querySelector("button").onclick = () => {
    toggleTooltip(eventSourceIndicator)
  }

  if (eventSourceState === "disabled") {
    variantNode.querySelector("a").onclick = connect
  } else if (eventSourceState === "connecting") {
    variantNode.querySelector("a").onclick = abort
  } else if (eventSourceState === "connected") {
    removeAutoShowTooltip(eventSourceIndicator)
    if (changeCount) {
      const changeLink = variantNode.querySelector(".eventsource-changes-link")
      changeLink.innerHTML = changeCount
      changeLink.onclick = () => {
        console.log(JSON.stringify(latestChangeMap, null, "  "), latestChangeMap)
        // eslint-disable-next-line no-alert
        window.parent.alert(JSON.stringify(latestChangeMap, null, "  "))
      }
      variantNode.querySelector(".eventsource-reload-link").onclick = reloadChanges
    }
  } else if (eventSourceState === "failed") {
    autoShowTooltip(eventSourceIndicator)
    variantNode.querySelector("a").onclick = reconnect
  }
}
