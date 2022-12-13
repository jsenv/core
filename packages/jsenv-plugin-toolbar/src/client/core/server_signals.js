import { signal } from "@preact/signals"

export const serverTooltipOpenedSignal = signal(false)

export const serverConnectionSignal = signal("default")
const serverEvents = window.__server_events__
if (serverEvents) {
  serverEvents.readyState.onchange = () => {
    serverConnectionSignal.value = serverEvents.readyState.value
  }
  serverConnectionSignal.value = serverEvents.readyState.value
}
