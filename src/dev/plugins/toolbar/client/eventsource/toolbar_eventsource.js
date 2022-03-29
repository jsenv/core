import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"
import {
  toggleTooltip,
  removeAutoShowTooltip,
  autoShowTooltip,
} from "../tooltip/tooltip.js"

const parentEventSourceClient = window.parent.__jsenv_event_source_client__

export const initToolbarEventSource = () => {
  removeForceHideElement(document.querySelector("#eventsource-indicator"))
  if (!parentEventSourceClient) {
    disableAutoreloadSetting()
    return
  }
  parentEventSourceClient.status.onchange = () => {
    updateEventSourceIndicator()
  }
  parentEventSourceClient.reloadMessagesSignal.onchange = () => {
    updateEventSourceIndicator()
  }
  const autoreloadCheckbox = document.querySelector("#toggle-autoreload")
  autoreloadCheckbox.checked = parentEventSourceClient.isAutoreloadEnabled()
  autoreloadCheckbox.onchange = () => {
    parentEventSourceClient.setAutoreloadPreference(autoreloadCheckbox.checked)
    updateEventSourceIndicator()
  }
  updateEventSourceIndicator()
}

const updateEventSourceIndicator = () => {
  const eventSourceIndicator = document.querySelector("#eventsource-indicator")
  const reloadMessages = parentEventSourceClient.reloadMessages
  const reloadMessageCount = reloadMessages.length

  const eventSourceConnectionState = parentEventSourceClient.status.value
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceConnectionState,
    autoreload: parentEventSourceClient.isAutoreloadEnabled() ? "on" : "off",
    changes: reloadMessageCount > 0 ? "yes" : "no",
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
    if (reloadMessageCount > 0) {
      const changeLink = variantNode.querySelector(".eventsource-changes-link")
      changeLink.innerHTML = reloadMessageCount
      changeLink.onclick = () => {
        console.log(reloadMessages)
        // eslint-disable-next-line no-alert
        window.parent.alert(JSON.stringify(reloadMessages, null, "  "))
      }

      const someFailed = reloadMessages.some((m) => m.status === "failed")
      const somePending = reloadMessages.some((m) => m.status === "pending")
      const applyLink = variantNode.querySelector(".eventsource-reload-link")
      applyLink.innerHTML = someFailed
        ? "failed"
        : somePending
        ? "applying..."
        : "apply changes"
      applyLink.onclick = someFailed
        ? () => {
            parentEventSourceClient.applyReloadMessageEffects()
          }
        : somePending
        ? () => {}
        : () => {
            parentEventSourceClient.applyReloadMessageEffects()
          }
    }
  } else if (eventSourceConnectionState === "disconnected") {
    autoShowTooltip(eventSourceIndicator)
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.connect()
    }
  }
}

const disableAutoreloadSetting = () => {
  document
    .querySelector(".settings-autoreload")
    .setAttribute("data-disabled", "true")
  document
    .querySelector(".settings-autoreload")
    .setAttribute("title", `Autoreload not available: disabled by server`)
  document.querySelector("#toggle-autoreload").disabled = true
}
