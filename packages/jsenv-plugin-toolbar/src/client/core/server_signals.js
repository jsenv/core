import { signal } from "@preact/signals"

export const serverTooltipOpenedSignal = signal(false)

export const serverConnectionSignal = signal("default")
const parentServerEvents = window.parent.__server_events__
if (parentServerEvents) {
  parentServerEvents.readyState.onchange = () => {
    serverConnectionSignal.value = parentServerEvents.readyState.value
  }
  serverConnectionSignal.value = parentServerEvents.readyState.value
}
