export const guardTooFastSecondCall = (
  callback,
  cooldownBetweenFileEvents = 40,
) => {
  const previousCallMsMap = new Map()
  return ({ url, event }) => {
    const previousCallMs = previousCallMsMap.get(url)
    const nowMs = Date.now()
    if (previousCallMs) {
      const msEllapsed = nowMs - previousCallMs
      if (msEllapsed < cooldownBetweenFileEvents) {
        previousCallMsMap.delete(url)
        return
      }
    }
    previousCallMsMap.set(url, nowMs)
    callback({ url, event })
  }
}
