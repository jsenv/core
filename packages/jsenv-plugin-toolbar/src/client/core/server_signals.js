import { signal, computed } from "@preact/signals"

export const serverTooltipRequestedSignal = signal(false)

export const serverConnectionSignal = signal("default")
const parentServerEvents = window.parent.__server_events__
if (parentServerEvents) {
  parentServerEvents.readyState.onchange = () => {
    serverConnectionSignal.value = parentServerEvents.readyState.value
  }
  serverConnectionSignal.value = parentServerEvents.readyState.value
}

export const serverTooltipOpenedSignal = computed(() => {
  const serverTooltipRequested = serverTooltipRequestedSignal.value
  const serverConnection = serverConnectionSignal.value

  return (
    serverTooltipRequested ||
    serverConnection === "connecting" ||
    serverConnection === "closed"
  )
})
