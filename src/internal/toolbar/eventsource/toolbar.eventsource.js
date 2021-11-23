import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"
import {
  toggleTooltip,
  removeAutoShowTooltip,
  autoShowTooltip,
} from "../tooltip/tooltip.js"

let livereloadingAvailableOnServer = false
const parentEventSourceClient = window.parent.__jsenv_event_source_client__

export const initToolbarEventSource = ({ livereloading }) => {
  removeForceHideElement(document.querySelector("#eventsource-indicator"))
  livereloadingAvailableOnServer = livereloading
  if (!livereloadingAvailableOnServer) {
    disableLivereloadSetting()
  }
  parentEventSourceClient.setConnectionStatusChangeCallback = () => {
    updateEventSourceIndicator()
  }
  const livereloadCheckbox = document.querySelector("#toggle-livereload")
  livereloadCheckbox.checked = parentEventSourceClient.isLivereloadEnabled()
  livereloadCheckbox.onchange = () => {
    parentEventSourceClient.setLivereloadPreference(livereloadCheckbox.checked)
    updateEventSourceIndicator()
  }
  updateEventSourceIndicator()
}

const updateEventSourceIndicator = () => {
  const eventSourceIndicator = document.querySelector("#eventsource-indicator")
  const fileChanges = parentEventSourceClient.getFileChanges()
  const changeCount = Object.keys(fileChanges).length
  const eventSourceConnectionState =
    parentEventSourceClient.getConnectionStatus()
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceConnectionState,
    livereload: parentEventSourceClient.isLivereloadEnabled() ? "on" : "off",
    changes: changeCount > 0 ? "yes" : "no",
  })

  const variantNode = document.querySelector(
    "#eventsource-indicator > [data-when-active]",
  )
  variantNode.querySelector("button").onclick = () => {
    toggleTooltip(eventSourceIndicator)
  }

  if (eventSourceConnectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.disconnect()
    }
  } else if (eventSourceConnectionState === "connected") {
    removeAutoShowTooltip(eventSourceIndicator)
    if (changeCount) {
      const changeLink = variantNode.querySelector(".eventsource-changes-link")
      changeLink.innerHTML = changeCount
      changeLink.onclick = () => {
        console.log(JSON.stringify(fileChanges, null, "  "), fileChanges)
        // eslint-disable-next-line no-alert
        window.parent.alert(JSON.stringify(fileChanges, null, "  "))
      }
      variantNode.querySelector(".eventsource-reload-link").onclick = () => {
        parentEventSourceClient.reloadIfNeeded()
      }
    }
  } else if (eventSourceConnectionState === "disconnected") {
    autoShowTooltip(eventSourceIndicator)
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.connect()
    }
  }
}

const disableLivereloadSetting = () => {
  document
    .querySelector(".settings-livereload")
    .setAttribute("data-disabled", "true")
  document
    .querySelector(".settings-livereload")
    .setAttribute("title", `Livereload not available: disabled by server`)
  document.querySelector("#toggle-livereload").disabled = true
}
