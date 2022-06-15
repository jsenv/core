export const guardTooFastSecondCall = (
  callback,
  cooldownBetweenFileEvents = 40,
) => {
  const previousCallMsMap = new Map()
  return (fileEvent) => {
    const { relativeUrl } = fileEvent
    const previousCallMs = previousCallMsMap.get(relativeUrl)
    const nowMs = Date.now()
    if (previousCallMs) {
      const msEllapsed = nowMs - previousCallMs
      if (msEllapsed < cooldownBetweenFileEvents) {
        previousCallMsMap.delete(relativeUrl)
        return
      }
    }
    previousCallMsMap.set(relativeUrl, nowMs)
    callback(fileEvent)
  }
}
