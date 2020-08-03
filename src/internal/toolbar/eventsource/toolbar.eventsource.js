import { removeForceHideElement } from "../util/dom.js"
import { createPromiseAndHooks } from "../util/util.js"
import { createPreference } from "../util/preferences.js"

import { toggleTooltip, removeAutoShowTooltip, autoShowTooltip } from "../tooltip/tooltip.js"
import { connectCompileServerEventSource } from "./connectCompileServerEventSource.js"

const livereloadingPreference = createPreference("livereloading")

export const initToolbarEventSource = ({ executedFileRelativeUrl }) => {
  removeForceHideElement(document.querySelector("#server-indicator"))
  connectEventSource(executedFileRelativeUrl)
}

let eventSourceConnection
let connectionReadyPromise

const connectEventSource = (executedFileRelativeUrl) => {
  const reloadPage = () => {
    window.parent.location.reload(true)
  }

  // reset livereload indicator ui
  applyServerIndicator()
  connectionReadyPromise = createPromiseAndHooks()

  eventSourceConnection = connectCompileServerEventSource(executedFileRelativeUrl, {
    onFileModified: () => {
      // here also update livereload indicator to indicate a file
      // was modified
      if (getLivereloadingPreference()) {
        reloadPage()
      }
    },
    onFileRemoved: () => {
      // here also update livereload indicator to indicate a file
      // was removed
      if (getLivereloadingPreference()) {
        reloadPage()
      }
    },
    onFileAdded: () => {
      // here also update livereload indicator to indicate a file
      // was added
      if (getLivereloadingPreference()) {
        reloadPage()
      }
    },
    onConnecting: ({ cancel }) => {
      applyServerIndicator("connecting", { abort: cancel })
    },
    onConnectionCancelled: ({ connect }) => {
      applyServerIndicator("disabled", { connect })
    },
    onConnectionFailed: ({ connect }) => {
      // make ui indicate the failure providing a way to reconnect manually
      applyServerIndicator("failed", { reconnect: connect })
    },
    onConnected: ({ cancel }) => {
      applyServerIndicator("connected", { disconnect: cancel })
      connectionReadyPromise.resolve()
    },
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

const applyServerIndicator = (
  state = "default",
  { connect, abort, disconnect, reconnect } = {},
) => {
  const serverIndicator = document.querySelector("#server-indicator")
  const variantContainer = serverIndicator.querySelector("[data-variant-container]")
  const currentVariant = variantContainer.querySelector(`[data-variant="${state}"]`)

  let variant
  if (currentVariant) {
    variant = currentVariant
  } else {
    variant = serverIndicator.querySelector(`[data-variant="${state}"]`).cloneNode(true)
    variantContainer.innerHTML = ""
    variantContainer.appendChild(variant)
  }

  serverIndicator.querySelector("button").onclick = () => {
    toggleTooltip(serverIndicator)
  }

  if (state === "disabled") {
    variant.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    variant.querySelector("a").onclick = abort
  } else if (state === "connected") {
    removeAutoShowTooltip(serverIndicator)
    variant.querySelector("a").onclick = disconnect
  } else if (state === "failed") {
    autoShowTooltip(serverIndicator)
    variant.querySelector("a").onclick = reconnect
  }
}
