import { registerDirectoryLifecycle } from "@jsenv/filesystem"

export const watchFiles = ({
  rootDirectoryUrl,
  patterns,
  fileChangeCallback,
  cooldownBetweenFileEvents,
}) => {
  if (cooldownBetweenFileEvents) {
    fileChangeCallback = guardTooFastSecondCall(
      fileChangeCallback,
      cooldownBetweenFileEvents,
    )
  }
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
    rootDirectoryUrl,
    {
      watchDescription: patterns,
      updated: ({ relativeUrl }) => {
        fileChangeCallback({ event: "modified", relativeUrl })
      },
      removed: ({ relativeUrl }) => {
        fileChangeCallback({ event: "removed", relativeUrl })
      },
      added: ({ relativeUrl }) => {
        fileChangeCallback({ event: "added", relativeUrl })
      },
      keepProcessAlive: false,
      recursive: true,
    },
  )

  return unregisterDirectoryLifecyle
}

const guardTooFastSecondCall = (callback, cooldownBetweenFileEvents = 40) => {
  const previousCallMsMap = new Map()
  return ({ relativeUrl, event }) => {
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
    callback({ relativeUrl, event })
  }
}
