import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant.js"
import {
  toggleTooltip,
  removeAutoShowTooltip,
  autoShowTooltip,
} from "../tooltips/tooltips.js"

const parentServerEvents = window.parent.__server_events__

export const renderServerIndicator = () => {
  removeForceHideElement(document.querySelector("#server_indicator"))
  if (!parentServerEvents) {
    disableAutoreloadSetting()
    return
  }
  parentServerEvents.readyState.onchange = () => {
    updateEventSourceIndicator(parentServerEvents.readyState.value)
  }
  updateEventSourceIndicator(parentServerEvents.readyState.value)
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
      parentServerEvents.disconnect()
    }
  } else if (connectionState === "open") {
    removeAutoShowTooltip(indicator)
  } else if (connectionState === "closed") {
    autoShowTooltip(indicator)
    variantNode.querySelector("a").onclick = () => {
      parentServerEvents.connect()
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
