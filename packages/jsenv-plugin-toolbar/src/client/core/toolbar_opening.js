import { signal } from "@preact/signals"

import { addExternalCommandCallback } from "./parent_window_communication.js"

export const toolbarOpenedSignal = signal(false)

export const openToolbar = () => {
  toolbarOpenedSignal.value = true
}

export const closeToolbar = () => {
  toolbarOpenedSignal.value = false
}

addExternalCommandCallback("openToolbar", openToolbar)
addExternalCommandCallback("closeToolbar", closeToolbar)
