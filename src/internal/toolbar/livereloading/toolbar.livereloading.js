import { removeForceHideElement } from "../util/dom.js"
import { createPromiseAndHooks } from "../util/util.js"
import { toggleTooltip, removeAutoShowTooltip, autoShowTooltip } from "../tooltip/tooltip.js"
import { getLivereloadingPreference, createLivereloading } from "./livereloading.js"

export const renderToolbarLivereload = ({ executedFileRelativeUrl }) => {
  removeForceHideElement(document.querySelector("#livereload-indicator"))
  connectLivereload(executedFileRelativeUrl)
}

let livereloadConnection
let livereloadReadyPromise

const connectLivereload = (executedFileRelativeUrl) => {
  const reloadPage = () => {
    // window.parent.location.reload(true)
  }

  // reset livereload indicator ui
  applyLivereloadIndicator()
  livereloadReadyPromise = createPromiseAndHooks()

  livereloadConnection = createLivereloading(executedFileRelativeUrl, {
    onFileChanged: () => {
      reloadPage()
    },
    onFileRemoved: () => {
      reloadPage()
    },
    onConnecting: ({ cancel }) => {
      applyLivereloadIndicator("connecting", { abort: cancel })
    },
    onConnectionCancelled: ({ connect }) => {
      applyLivereloadIndicator("off", { connect })
    },
    onConnectionFailed: ({ connect }) => {
      // make ui indicate the failure providing a way to reconnect manually
      applyLivereloadIndicator("disconnected", { reconnect: connect })
    },
    onConnected: ({ cancel }) => {
      applyLivereloadIndicator("connected", { disconnect: cancel })
      livereloadReadyPromise.resolve()
    },
  })

  if (getLivereloadingPreference()) {
    livereloadConnection.connect()
  } else {
    applyLivereloadIndicator("off", { connect: livereloadConnection.connect })
    livereloadReadyPromise.resolve()
  }
}

export const disconnectLivereload = () => {
  if (livereloadConnection) {
    livereloadConnection.disconnect()
    livereloadConnection = undefined
  }
}

export const waitLivereloadReady = () => livereloadReadyPromise

const applyLivereloadIndicator = (
  state = "default",
  { connect, abort, disconnect, reconnect } = {},
) => {
  const livereloadIndicator = document.querySelector("#livereload-indicator")
  const variantContainer = livereloadIndicator.querySelector("[data-variant-container]")
  const currentVariant = variantContainer.querySelector(`[data-variant="${state}"]`)

  let variant
  if (currentVariant) {
    variant = currentVariant
  } else {
    variant = livereloadIndicator.querySelector(`[data-variant="${state}"]`).cloneNode(true)
    variantContainer.innerHTML = ""
    variantContainer.appendChild(variant)
  }

  livereloadIndicator.querySelector("button").onclick = () => {
    toggleTooltip(livereloadIndicator)
  }

  if (state === "off") {
    variant.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    variant.querySelector("a").onclick = abort
  } else if (state === "connected") {
    removeAutoShowTooltip(livereloadIndicator)
    variant.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    autoShowTooltip(livereloadIndicator)
    variant.querySelector("a").onclick = reconnect
  }
}
