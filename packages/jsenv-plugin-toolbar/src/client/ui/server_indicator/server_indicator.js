import { effect } from "@preact/signals"

import { serverTooltipOpenedSignal } from "../../core/server_signals.js"
import {
  requestServerTooltip,
  closeServerTooltip,
} from "../../core/server_actions.js"
import { removeForceHideElement } from "../util/dom.js"
import { enableVariant } from "../variant.js"

const parentServerEvents = window.parent.__server_events__
const serverIndicator = document.querySelector("#server_indicator")

export const renderServerIndicator = () => {
  effect(() => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value
    if (serverTooltipOpened) {
      serverIndicator.setAttribute("data-tooltip-visible", "")
    } else {
      serverIndicator.removeAttribute("data-tooltip-visible")
    }
  })

  if (!parentServerEvents) {
    disableAutoreloadSetting()
    return
  }
  removeForceHideElement(document.querySelector("#server_indicator"))
  parentServerEvents.readyState.onchange = () => {
    updateEventSourceIndicator(parentServerEvents.readyState.value)
  }
  updateEventSourceIndicator(parentServerEvents.readyState.value)
}

const updateEventSourceIndicator = (connectionState) => {
  enableVariant(serverIndicator, { connectionState })
  const variantNode = document.querySelector(
    "#server_indicator > [data-when-active]",
  )
  variantNode.querySelector("button").onclick = () => {
    const serverTooltipOpened = serverTooltipOpenedSignal.value
    if (serverTooltipOpened) {
      closeServerTooltip()
    } else {
      requestServerTooltip()
    }
  }
  if (connectionState === "connecting") {
    variantNode.querySelector("a").onclick = () => {
      parentServerEvents.disconnect()
    }
  } else if (connectionState === "open") {
  } else if (connectionState === "closed") {
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
