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
    const changes = changesSignal.value
    const changeCount = changes.length
    enableVariant(changesIndicator, {
      changes: !autoreloadEnabled && changeCount ? "yes" : "no",
    })
    if (changeCount) {
      changesIndicator.querySelector(".tooltip_text").innerHTML =
        computeTooltipText({ changes })
      changesIndicator.querySelector(".tooltip_text a").onclick = () => {
        // eslint-disable-next-line no-alert
        window.alert(JSON.stringify(changes, null, "  "))
        console.log(changes)
      }
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

const computeTooltipText = ({ changes }) => {
  const changesCount = changes.length
  if (changesCount === 1) {
    return `There is <a href="javascript:void(0)">1</a> change to apply`
  }
  return `There is  <a href="javascript:void(0)">${changesCount}<a> changes to apply`
}
