import { effect } from "@preact/signals"

import { parentWindowReloader } from "../../core/parent_window_context.js"
import {
  autoreloadEnabledSignal,
  changesSignal,
} from "../../core/parent_window_signals.js"
import { changesTooltipOpenedSignal } from "../../core/changes_signals.js"
import {
  openChangesToolip,
  closeChangesToolip,
} from "../../core/changes_actions.js"
import { enableVariant } from "../variant.js"

const changesIndicator = document.querySelector("#changes_indicator")

export const renderChangesIndicator = () => {
  effect(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value
    const changeCount = changesSignal.value.length
    enableVariant(changesIndicator, {
      changes: autoreloadEnabled && changeCount ? "yes" : "no",
    })
    if (changeCount) {
      changesIndicator.querySelector(
        ".tooltip_text",
      ).innerHTML = `There is ${changeCount} changes to apply`
      changesIndicator.querySelector(".changes_text").innerHTML = changeCount
    }
  })

  changesIndicator.querySelector(".tooltip_action").onclick = () => {
    parentWindowReloader.reload()
  }

  effect(() => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value
    if (changesTooltipOpened) {
      changesIndicator.setAttribute("data-tooltip-visible", "")
    } else {
      changesIndicator.removeAttribute("data-tooltip-visible")
    }
  })
  const button = changesIndicator.querySelector("button")
  button.onclick = () => {
    const changesTooltipOpened = changesTooltipOpenedSignal.value
    if (changesTooltipOpened) {
      closeChangesToolip()
    } else {
      openChangesToolip()
    }
  }
}
