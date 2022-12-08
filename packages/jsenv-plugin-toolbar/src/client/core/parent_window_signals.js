import { effect, signal } from "@preact/signals"

import { parentWindowReloader } from "./parent_window_context.js"

export const autoreloadEnabledSignal = signal(false)
export const reloaderStatusSignal = signal("idle")
export const changesSignal = signal(0)

if (parentWindowReloader) {
  autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled
  parentWindowReloader.autoreload.onchange = () => {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled
  }
  reloaderStatusSignal.value = parentWindowReloader.status.value
  parentWindowReloader.status.onchange = () => {
    reloaderStatusSignal.value = parentWindowReloader.status.value
  }
  effect(() => {
    const reloaderStatus = reloaderStatusSignal.value
    if (reloaderStatus === "can_reload") {
      changesSignal.value = parentWindowReloader.messages.length
    } else {
      changesSignal.value = 0
    }
  })
}
