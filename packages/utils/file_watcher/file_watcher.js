import { registerDirectoryLifecycle } from "@jsenv/filesystem"

export const watchFiles = ({
  rootDirectoryUrl,
  watchPatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  cooldownBetweenFileEvents = 0,
  fileChangeCallback,
}) => {
  const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
    rootDirectoryUrl,
    {
      watchPatterns,
      cooldownBetweenFileEvents,
      keepProcessAlive: false,
      recursive: true,
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
    },
  )

  return unregisterDirectoryLifecyle
}
