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
  parentEventSourceClient.status.onchange = () => {
    updateEventSourceIndicator()
  }
  parentEventSourceClient.serverUpdatesSignal.onchange = () => {
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
  const serverUpdates = parentEventSourceClient.serverUpdates
  const serverUpdateCount = serverUpdates.length

  const eventSourceConnectionState = parentEventSourceClient.status.value
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceConnectionState,
    livereload: parentEventSourceClient.isLivereloadEnabled() ? "on" : "off",
    changes: serverUpdateCount > 0 ? "yes" : "no",
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
    if (serverUpdateCount > 0) {
      const changeLink = variantNode.querySelector(".eventsource-changes-link")
      changeLink.innerHTML = serverUpdateCount
      changeLink.onclick = () => {
        console.log(serverUpdates)
        // eslint-disable-next-line no-alert
        window.parent.alert(JSON.stringify(serverUpdates, null, "  "))
      }
      variantNode.querySelector(".eventsource-reload-link").onclick = () => {
        parentEventSourceClient.applyServerChanges()
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
