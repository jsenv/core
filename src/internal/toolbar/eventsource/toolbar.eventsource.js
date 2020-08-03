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

const changes = []
let eventSourceState = "default"
let eventSourceHooks = {}
let eventSourceConnection
let connectionReadyPromise

const connectEventSource = (executedFileRelativeUrl) => {
  updateEventSourceIndicator()
  connectionReadyPromise = createPromiseAndHooks()

  eventSourceConnection = connectCompileServerEventSource(executedFileRelativeUrl, {
    onFileModified: (file) => {
      changes.push({ type: "modified", file })
      updateEventSourceIndicator()
      const livereloadingEnabled = getLivereloadingPreference()
      if (livereloadingEnabled) {
        reloadPage()
      }
    },
    onFileRemoved: (file) => {
      changes.push({ type: "removed", file })
      updateEventSourceIndicator()
      const livereloadingEnabled = getLivereloadingPreference()
      if (livereloadingEnabled) {
        reloadPage()
      }
    },
    onFileAdded: (file) => {
      changes.push({ type: "added", file })
      updateEventSourceIndicator()
      const livereloadingEnabled = getLivereloadingPreference()
      if (livereloadingEnabled) {
        reloadPage()
      }
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
    },
  })

  eventSourceConnection.connect()
}

const reloadPage = () => {
  window.parent.location.reload(true)
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
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceState,
    livereload: getLivereloadingPreference() ? "on" : "off",
    changes: changes.length ? "yes" : "no",
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
    if (changes.length) {
      const message = variantNode.querySelector(".eventsource-changes-message")
      message.innerHTML = changesToMessage(changes)
      variantNode.querySelector(".eventsource-reload-link").onclick = reloadPage
    }
  } else if (eventSourceState === "failed") {
    autoShowTooltip(eventSourceIndicator)
    variantNode.querySelector("a").onclick = reconnect
  }
}

const changesToMessage = (changes) => {
  const added = []
  const modified = []
  const removed = []

  changes.reverse().forEach(({ type, file }) => {
    if (added.includes(file)) return
    if (modified.includes(file)) return
    if (removed.includes(file)) return

    if (type === "added") {
      added.push(file)
      return
    }
    if (type === "modified") {
      modified.push(file)
      return
    }
    removed.push(file)
  })

  let message = ""

  if (added.length) {
    message += `${added.length} ${added.length > 1 ? "files" : "file"} added`
  }
  if (modified.length) {
    message += `${modified.length} ${modified.length > 1 ? "files" : "file"} modified`
  }
  if (removed.length) {
    message += `${removed.length} ${removed.length > 1 ? "files" : "file"} removed`
  }

  return message
}
