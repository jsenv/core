import { registerDirectoryLifecycle } from "@jsenv/filesystem"

import { guardTooFastSecondCall } from "./guard_second_call.js"

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
        fileChangeCallback({
          url: new URL(relativeUrl, rootDirectoryUrl).href,
          event: "modified",
        })
      },
      removed: ({ relativeUrl }) => {
        fileChangeCallback({
          url: new URL(relativeUrl, rootDirectoryUrl).href,
          event: "removed",
        })
      },
      added: ({ relativeUrl }) => {
        fileChangeCallback({
          url: new URL(relativeUrl, rootDirectoryUrl).href,
          event: "added",
        })
      },
      keepProcessAlive: false,
      recursive: true,
    },
  )

  return unregisterDirectoryLifecyle
}
