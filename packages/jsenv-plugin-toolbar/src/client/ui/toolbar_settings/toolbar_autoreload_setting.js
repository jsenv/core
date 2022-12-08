import { effect } from "@preact/signals"

import { autoreloadEnabledSignal } from "../../core/parent_window_signals.js"
import {
  disableAutoreload,
  enableAutoreload,
} from "../../core/parent_window_actions.js"

export const renderToolbarAutoreloadSetting = () => {
  const parentWindowReloader = window.parent.__reloader__
  if (!parentWindowReloader) {
    disableAutoreloadSetting()
    return
  }

  const autoreloadCheckbox = document.querySelector("#toggle_autoreload")
  effect(() => {
    const autoreloadEnabled = autoreloadEnabledSignal.value
    if (autoreloadEnabled) {
      autoreloadCheckbox.checked = true
    } else {
      autoreloadCheckbox.checked = false
    }
  })

  autoreloadCheckbox.onchange = () => {
    if (autoreloadCheckbox.checked) {
      enableAutoreload()
    } else {
      disableAutoreload()
    }
  }
}

const disableAutoreloadSetting = () => {
  document
    .querySelector(".settings_autoreload")
    .setAttribute("data-disabled", "true")
  document
    .querySelector(".settings_autoreload")
    .setAttribute("title", `Autoreload not enabled on server`)
  document.querySelector("#toggle_autoreload").disabled = true
}

// const changeLink = variantNode.querySelector(".eventsource-changes-link")
// changeLink.innerHTML = reloadMessageCount
// changeLink.onclick = () => {
//   console.log(reloadMessages)
//   // eslint-disable-next-line no-alert
//   window.parent.alert(JSON.stringify(reloadMessages, null, "  "))
// }

// const someFailed = reloadMessages.some((m) => m.status === "failed")
// const somePending = reloadMessages.some((m) => m.status === "pending")
// const applyLink = variantNode.querySelector(".eventsource-reload-link")
// applyLink.innerHTML = someFailed
//   ? "failed"
//   : somePending
//   ? "applying..."
//   : "apply changes"
// applyLink.onclick = someFailed
//   ? () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }
//   : somePending
//   ? () => {}
//   : () => {
//       parentEventSourceClient.applyReloadMessageEffects()
//     }

// parentEventSourceClient.reloadMessagesSignal.onchange = () => {
//   updateEventSourceIndicator()
// }
// const autoreloadCheckbox = document.querySelector("#toggle-autoreload")
// autoreloadCheckbox.checked = parentEventSourceClient.isAutoreloadEnabled()
// autoreloadCheckbox.onchange = () => {
//   parentEventSourceClient.setAutoreloadPreference(autoreloadCheckbox.checked)
//   updateEventSourceIndicator()
// }
