import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant.js"
import {
  toggleTooltip,
  removeAutoShowTooltip,
  autoShowTooltip,
} from "../tooltip.js"

const parentEventSourceClient = window.parent.__jsenv_event_source_client__

export const renderServerIndicator = () => {
  removeForceHideElement(document.querySelector("#eventsource-indicator"))
  if (!parentEventSourceClient) {
    disableAutoreloadSetting()
    return
  }
  parentEventSourceClient.status.onchange = () => {
    updateEventSourceIndicator()
  }
  updateEventSourceIndicator()
}

const updateEventSourceIndicator = () => {
  const eventSourceIndicator = document.querySelector("#eventsource-indicator")
  const eventSourceConnectionState = parentEventSourceClient.status.value
  enableVariant(eventSourceIndicator, {
    eventsource: eventSourceConnectionState,
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
