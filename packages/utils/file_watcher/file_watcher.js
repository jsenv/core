import { registerDirectoryLifecycle } from "@jsenv/filesystem"

export const watchFiles = ({
  rootDirectoryUrl,
  watchedFilePatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  cooldownBetweenFileEvents = 0,
  fileChangeCallback,
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
      watchDescription: watchedFilePatterns,
      updated: ({ relativeUrl }) => {
        fileChangeCallback({ relativeUrl, event: "modified" })
      },
      removed: ({ relativeUrl }) => {
        fileChangeCallback({ relativeUrl, event: "removed" })
      },
      added: ({ relativeUrl }) => {
        fileChangeCallback({ relativeUrl, event: "added" })
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
