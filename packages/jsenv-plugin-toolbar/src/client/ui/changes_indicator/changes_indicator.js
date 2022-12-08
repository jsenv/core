import { effect } from "@preact/signals"

import {
  autoreloadEnabledSignal,
  changesSignal,
} from "../../core/parent_window_signals.js"
import { enableVariant } from "../variant.js"

const changesIndicator = document.querySelector("#changes_indicator")

export const renderChangesIndicator = () => {
  effect(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value
    if (autoreloadEnabled) {
    }
  })

  effect(() => {
    const changes = changesSignal.value
    enableVariant(changesIndicator, {
      changes: changes ? "yes" : "no",
    })
    if (changes) {
      changesIndicator.querySelector(".changes_text").innerHTML = changes
    }
  })
}
