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
    window.parent.location.reload(true)
  }

  // reset livereload indicator ui
  applyLivereloadIndicator()
  livereloadReadyPromise = createPromiseAndHooks()

  let connectedOnce = false
  livereloadConnection = createLivereloading(executedFileRelativeUrl, {
    onFileChanged: () => {
      reloadPage()
    },
    onFileRemoved: () => {
      reloadPage()
    },
    onConnecting: ({ abort }) => {
      applyLivereloadIndicator("connecting", { abort })
    },
    onAborted: ({ connect }) => {
      applyLivereloadIndicator("off", { connect })
    },
    onConnectionFailed: ({ reconnect }) => {
      // make ui indicate the failure providing a way to reconnect manually
      applyLivereloadIndicator("disconnected", { reconnect })
    },
    onConnected: ({ disconnect }) => {
      applyLivereloadIndicator("connected", { disconnect })
      if (connectedOnce) {
        // we have lost connection to the server, we might have missed some file changes
        // let's re-execute the file
        // reloadPage()
      } else {
        connectedOnce = true
        livereloadReadyPromise.resolve()
      }
    },
  })

  if (getLivereloadingPreference()) {
    livereloadConnection.connect()
  } else {
    applyLivereloadIndicator("off", { connect: livereloadConnection.connect })
    connectedOnce = true
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
  const buttonVariant = livereloadIndicator
    .querySelector(`[data-variant="${state}"]`)
    .cloneNode(true)
  const variantContainer = livereloadIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(buttonVariant)

  livereloadIndicator.querySelector("button").onclick = () => {
    toggleTooltip(livereloadIndicator)
  }

  if (state === "off") {
    buttonVariant.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    buttonVariant.querySelector("a").onclick = abort
  } else if (state === "connected") {
    removeAutoShowTooltip(livereloadIndicator)
    buttonVariant.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    autoShowTooltip(livereloadIndicator)
    buttonVariant.querySelector("a").onclick = reconnect
  }
}
