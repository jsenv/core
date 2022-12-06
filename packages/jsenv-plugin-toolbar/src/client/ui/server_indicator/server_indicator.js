import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant.js"
import {
  toggleTooltip,
  removeAutoShowTooltip,
  autoShowTooltip,
} from "../tooltips/tooltips.js"

const parentEventSourceClient = window.parent.__jsenv_event_source_client__

export const renderServerIndicator = () => {
  removeForceHideElement(document.querySelector("#server_indicator"))
  updateEventSourceIndicator("connected")
  if (!parentEventSourceClient) {
    disableAutoreloadSetting()
    return
  }
  parentEventSourceClient.status.onchange = () => {
    updateEventSourceIndicator(parentEventSourceClient.status.value)
  }
  updateEventSourceIndicator(parentEventSourceClient.status.value)
}

const updateEventSourceIndicator = (connectionState) => {
  const indicator = document.querySelector("#server_indicator")
  enableVariant(indicator, { connectionState })
  const variantNode = document.querySelector(
    "#server_indicator > [data-when-active]",
  )
  variantNode.querySelector("button").onclick = () => {
    toggleTooltip(indicator)
  }
  if (connectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.disconnect()
    }
  } else if (connectionState === "connected") {
    removeAutoShowTooltip(indicator)
  } else if (connectionState === "disconnected") {
    autoShowTooltip(indicator)
    variantNode.querySelector("a").onclick = () => {
      parentEventSourceClient.connect()
    }
  }
}

const disableAutoreloadSetting = () => {
  document
    .querySelector(".settings_autoreload")
    .setAttribute("data-disabled", "true")
  document
    .querySelector(".settings_autoreload")
    .setAttribute("title", `Autoreload not available: disabled by server`)
  document.querySelector("#toggle_autoreload").disabled = true
}
