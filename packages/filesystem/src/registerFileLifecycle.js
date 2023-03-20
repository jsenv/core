import { statSync } from "node:fs"
import { dirname, basename } from "node:path"
import { urlToFileSystemPath } from "@jsenv/urls"

import { assertAndNormalizeFileUrl } from "./file_url_validation.js"
import { guardTooFastSecondCall } from "./internal/guard_second_call.js"
import { statsToType } from "./internal/statsToType.js"
import { createWatcher } from "./internal/createWatcher.js"
import { trackResources } from "./internal/track_resources.js"

export const registerFileLifecycle = (
  source,
  {
    added,
    updated,
    removed,
    notifyExistent = false,
    keepProcessAlive = true,
    cooldownBetweenFileEvents = 0,
  },
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source)
  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`)
  }
  if (!undefinedOrFunction(updated)) {
    throw new TypeError(
      `updated must be a function or undefined, got ${updated}`,
    )
  }
  if (!undefinedOrFunction(removed)) {
    throw new TypeError(
      `removed must be a function or undefined, got ${removed}`,
    )
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCall(added, cooldownBetweenFileEvents)
    }
    if (updated) {
      updated = guardTooFastSecondCall(updated, cooldownBetweenFileEvents)
    }
    if (removed) {
      removed = guardTooFastSecondCall(removed, cooldownBetweenFileEvents)
    }
  }

  const tracker = trackResources()

  const handleFileFound = ({ existent }) => {
    const fileMutationStopWatching = watchFileMutation(sourceUrl, {
      updated,
      removed: () => {
        fileMutationStopTracking()
        watchFileAdded()
        if (removed) {
          removed()
        }
      },
      keepProcessAlive,
    })
    const fileMutationStopTracking = tracker.registerCleanupCallback(
      fileMutationStopWatching,
    )

    if (added) {
      if (existent) {
        if (notifyExistent) {
          added({ existent: true })
        }
      } else {
        added({})
      }
    }
  }

  const watchFileAdded = () => {
    const fileCreationStopWatching = watchFileCreation(
      sourceUrl,
      () => {
        fileCreationgStopTracking()
        handleFileFound({ existent: false })
      },
      keepProcessAlive,
    )
    const fileCreationgStopTracking = tracker.registerCleanupCallback(
      fileCreationStopWatching,
    )
  }

  const sourceType = entryToTypeOrNull(sourceUrl)
  if (sourceType === null) {
    if (added) {
      watchFileAdded()
    } else {
      throw new Error(
        `${urlToFileSystemPath(sourceUrl)} must lead to a file, found nothing`,
      )
    }
  } else if (sourceType === "file") {
    handleFileFound({ existent: true })
  } else {
    throw new Error(
      `${urlToFileSystemPath(
        sourceUrl,
      )} must lead to a file, type found instead`,
    )
  }

  return tracker.cleanup
}

const entryToTypeOrNull = (url) => {
  try {
    const stats = statSync(new URL(url))
    return statsToType(stats)
  } catch (e) {
    if (e.code === "ENOENT") {
      return null
    }
    throw e
  }
}

const undefinedOrFunction = (value) =>
  typeof value === "undefined" || typeof value === "function"

const watchFileCreation = (source, callback, keepProcessAlive) => {
  const sourcePath = urlToFileSystemPath(source)
  const sourceFilename = basename(sourcePath)
  const directoryPath = dirname(sourcePath)
  let directoryWatcher = createWatcher(directoryPath, {
    persistent: keepProcessAlive,
  })
  directoryWatcher.on("change", (eventType, filename) => {
    if (filename && filename !== sourceFilename) return

    const type = entryToTypeOrNull(source)
    // ignore if something else with that name gets created
    // we are only interested into files
    if (type !== "file") return

    directoryWatcher.close()
    directoryWatcher = undefined
    callback()
  })

  return () => {
    if (directoryWatcher) {
      directoryWatcher.close()
    }
  }
}

const watchFileMutation = (
  sourceUrl,
  { updated, removed, keepProcessAlive },
) => {
  let watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    persistent: keepProcessAlive,
  })

  watcher.on("change", () => {
    const sourceType = entryToTypeOrNull(sourceUrl)

    if (sourceType === null) {
      watcher.close()
      watcher = undefined
      if (removed) {
        removed()
      }
    } else if (sourceType === "file") {
      if (updated) {
        updated()
      }
    }
  })

  return () => {
    if (watcher) {
      watcher.close()
    }
  }
}
