import { readdirSync, statSync } from "node:fs"
import {
  normalizeStructuredMetaMap,
  urlCanContainsMetaMatching,
  urlToMeta,
} from "@jsenv/url-meta"

import { assertAndNormalizeDirectoryUrl } from "./assertAndNormalizeDirectoryUrl.js"
import { statsToType } from "./internal/statsToType.js"
import { guardTooFastSecondCall } from "./internal/guard_second_call.js"
import { replaceBackSlashesWithSlashes } from "./internal/replaceBackSlashesWithSlashes.js"
import { createWatcher } from "./internal/createWatcher.js"
import { trackRessources } from "./internal/trackRessources.js"
import { urlToFileSystemPath } from "./urlToFileSystemPath.js"
import { urlToRelativeUrl } from "./urlToRelativeUrl.js"

const isLinux = process.platform === "linux"
// linux does not support recursive option
const fsWatchSupportsRecursive = !isLinux

export const registerDirectoryLifecycle = (
  source,
  {
    debug = false,
    added,
    updated,
    removed,
    watchPatterns = {
      "./**/*": true,
    },
    notifyExistent = false,
    keepProcessAlive = true,
    recursive = false,
    // filesystem might dispatch more events than expected
    // Code can use "cooldownBetweenFileEvents" to prevent that
    // BUT it is UNADVISED to rely on this as explained later (search for "is lying" in this file)
    // For this reason"cooldownBetweenFileEvents" should be reserved to scenarios
    // like unit tests
    cooldownBetweenFileEvents = 0,
  },
) => {
  const sourceUrl = assertAndNormalizeDirectoryUrl(source)
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

  const structuredMetaMap = normalizeStructuredMetaMap(
    { watch: watchPatterns },
    sourceUrl,
  )
  const getWatchPatternValue = ({ url, type }) => {
    if (type === "directory") {
      let firstMeta = false
      urlCanContainsMetaMatching({
        url: `${url}/`,
        structuredMetaMap,
        predicate: ({ watch }) => {
          if (watch) {
            firstMeta = watch
          }
          return watch
        },
      })
      return firstMeta
    }
    const filesystemEntryMeta = urlToMeta({
      url,
      structuredMetaMap,
    })
    return filesystemEntryMeta.watch
  }
  const tracker = trackRessources()
  const infoMap = new Map()
  const readEntryInfo = (url) => {
    try {
      const relativeUrl = urlToRelativeUrl(url, source)
      const previousInfo = infoMap.get(relativeUrl)
      const stats = statSync(new URL(url))
      const type = statsToType(stats)
      const patternValue = previousInfo
        ? previousInfo.patternValue
        : getWatchPatternValue({ url, type })
      return {
        previousInfo,
        url,
        relativeUrl,
        type,
        atimeMs: stats.atimeMs,
        mtimeMs: stats.mtimeMs,
        patternValue,
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        return null
      }
      throw e
    }
  }

  const handleDirectoryEvent = ({
    directoryRelativeUrl,
    filename,
    eventType,
  }) => {
    if (filename) {
      if (directoryRelativeUrl) {
        handleChange(`${directoryRelativeUrl}/${filename}`)
        return
      }
      handleChange(`${filename}`)
      return
    }
    if (eventType === "rename") {
      if (!removed && !added) {
        return
      }
      // we might receive `rename` without filename
      // in that case we try to find ourselves which file was removed.
      let relativeUrlCandidateArray = Array.from(infoMap.keys())
      if (recursive && !fsWatchSupportsRecursive) {
        relativeUrlCandidateArray = relativeUrlCandidateArray.filter(
          (relativeUrlCandidate) => {
            if (!directoryRelativeUrl) {
              // ensure entry is top level
              if (relativeUrlCandidate.includes("/")) {
                return false
              }
              return true
            }
            // entry not inside this directory
            if (!relativeUrlCandidate.startsWith(directoryRelativeUrl)) {
              return false
            }
            const afterDirectory = relativeUrlCandidate.slice(
              directoryRelativeUrl.length + 1,
            )
            // deep inside this directory
            if (afterDirectory.includes("/")) {
              return false
            }
            return true
          },
        )
      }
      const removedEntryRelativeUrl = relativeUrlCandidateArray.find(
        (relativeUrlCandidate) => {
          try {
            statSync(new URL(relativeUrlCandidate, sourceUrl))
            return false
          } catch (e) {
            if (e.code === "ENOENT") {
              return true
            }
            throw e
          }
        },
      )
      if (removedEntryRelativeUrl) {
        handleEntryLost(infoMap.get(removedEntryRelativeUrl))
      }
    }
  }

  const handleChange = (relativeUrl) => {
    const entryUrl = new URL(relativeUrl, sourceUrl).href
    const entryInfo = readEntryInfo(entryUrl)
    if (!entryInfo) {
      const previousEntryInfo = infoMap.get(relativeUrl)
      if (!previousEntryInfo) {
        // on MacOS it's possible to receive a "rename" event for
        // a file that does not exists...
        return
      }
      if (debug) {
        console.debug(`"${relativeUrl}" removed`)
      }
      handleEntryLost(previousEntryInfo)
      return
    }
    const { previousInfo } = entryInfo
    if (!previousInfo) {
      if (debug) {
        console.debug(`"${relativeUrl}" added`)
      }
      handleEntryFound(entryInfo)
      return
    }
    if (entryInfo.type !== previousInfo.type) {
      // it existed and was replaced by something else
      // we don't handle this as an update. We rather say the ressource
      // is lost and something else is found (call removed() then added())
      handleEntryLost(previousInfo)
      handleEntryFound(entryInfo)
      return
    }
    if (entryInfo.type === "directory") {
      // a directory cannot really be updated in way that matters for us
      // filesystem is trying to tell us the directory content have changed
      // but we don't care about that
      // we'll already be notified about what has changed
      return
    }
    // something has changed at this relativeUrl (the file existed and was not deleted)
    // it's possible to get there without a real update
    // (file content is the same and file mtime is the same).
    // In short filesystem is sometimes "lying"
    // Not trying to guard against that because:
    // - hurt perfs a lot
    // - it happens very rarely
    // - it's not really a concern in practice
    // - filesystem did not send an event out of nowhere:
    //   something occured but we don't know exactly what
    // maybe we should exclude some stuff as done in
    // https://github.com/paulmillr/chokidar/blob/b2c4f249b6cfa98c703f0066fb4a56ccd83128b5/lib/nodefs-handler.js#L366
    if (debug) {
      console.debug(`"${relativeUrl}" modified`)
    }
    handleEntryUpdated(entryInfo)
  }
  const handleEntryFound = (entryInfo, { notify = true } = {}) => {
    infoMap.set(entryInfo.relativeUrl, entryInfo)
    if (entryInfo.type === "directory") {
      const directoryUrl = `${entryInfo.url}/`
      readdirSync(new URL(directoryUrl)).forEach((entryName) => {
        const childEntryUrl = new URL(entryName, directoryUrl).href
        const childEntryInfo = readEntryInfo(childEntryUrl)
        if (childEntryInfo && childEntryInfo.patternValue) {
          handleEntryFound(childEntryInfo, { notify })
        }
      })
      // we must watch manually every directory we find
      if (!fsWatchSupportsRecursive) {
        const watcher = createWatcher(urlToFileSystemPath(entryInfo.url), {
          persistent: keepProcessAlive,
        })
        tracker.registerCleanupCallback(() => {
          watcher.close()
        })
        watcher.on("change", (eventType, filename) => {
          handleDirectoryEvent({
            directoryRelativeUrl: entryInfo.relativeUrl,
            filename: filename ? replaceBackSlashesWithSlashes(filename) : "",
            eventType,
          })
        })
      }
    }
    if (added && entryInfo.patternValue && notify) {
      added({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs,
      })
    }
  }
  const handleEntryLost = (entryInfo) => {
    infoMap.delete(entryInfo.relativeUrl)
    if (removed && entryInfo.patternValue) {
      removed({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs,
      })
    }
  }
  const handleEntryUpdated = (entryInfo) => {
    infoMap.set(entryInfo.relativeUrl, entryInfo)
    if (updated && entryInfo.patternValue) {
      updated({
        relativeUrl: entryInfo.relativeUrl,
        type: entryInfo.type,
        patternValue: entryInfo.patternValue,
        mtime: entryInfo.mtimeMs,
        previousMtime: entryInfo.previousInfo.mtimeMs,
      })
    }
  }

  readdirSync(new URL(sourceUrl)).forEach((entry) => {
    const entryUrl = new URL(entry, sourceUrl).href
    const entryInfo = readEntryInfo(entryUrl)
    if (entryInfo && entryInfo.patternValue) {
      handleEntryFound(entryInfo, {
        notify: notifyExistent,
      })
    }
  })
  if (debug) {
    const relativeUrls = Array.from(infoMap.keys())
    if (relativeUrls.length === 0) {
      console.debug(`No file found`)
    } else {
      console.debug(
        `${relativeUrls.length} file found: 
${relativeUrls.join("\n")}`,
      )
    }
  }
  const watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
    recursive: recursive && fsWatchSupportsRecursive,
    persistent: keepProcessAlive,
  })
  tracker.registerCleanupCallback(() => {
    watcher.close()
  })
  watcher.on("change", (eventType, fileSystemPath) => {
    handleDirectoryEvent({
      ...fileSystemPathToDirectoryRelativeUrlAndFilename(fileSystemPath),
      eventType,
    })
  })

  return tracker.cleanup
}

const undefinedOrFunction = (value) => {
  return typeof value === "undefined" || typeof value === "function"
}

const fileSystemPathToDirectoryRelativeUrlAndFilename = (path) => {
  if (!path) {
    return {
      directoryRelativeUrl: "",
      filename: "",
    }
  }

  const normalizedPath = replaceBackSlashesWithSlashes(path)
  const slashLastIndex = normalizedPath.lastIndexOf("/")
  if (slashLastIndex === -1) {
    return {
      directoryRelativeUrl: "",
      filename: normalizedPath,
    }
  }

  const directoryRelativeUrl = normalizedPath.slice(0, slashLastIndex)
  const filename = normalizedPath.slice(slashLastIndex + 1)
  return {
    directoryRelativeUrl,
    filename,
  }
}
