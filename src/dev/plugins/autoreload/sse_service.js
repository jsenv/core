import { createSSERoom } from "@jsenv/server"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"

import { watchFiles } from "@jsenv/utils/file_watcher/file_watcher.js"

export const createSSEService = ({
  rootDirectoryUrl,
  autoreloadPatterns,
  onFileChange,
  hotUpdateCallbackList,
  cooldownBetweenFileEvents = 0,
}) => {
  const destroyCallbackList = createCallbackListNotifiedOnce()
  // wait 100ms to actually start watching
  // otherwise server starting is delayed by the filesystem scan done in
  // registerDirectoryLifecycle
  const timeout = setTimeout(() => {
    const unregisterDirectoryLifecyle = watchFiles({
      rootDirectoryUrl,
      patterns: {
        ...autoreloadPatterns,
        ".jsenv/": false,
      },
      cooldownBetweenFileEvents,
      fileChangeCallback: onFileChange,
    })
    destroyCallbackList.add(unregisterDirectoryLifecyle)
  }, 100)
  destroyCallbackList.add(() => {
    clearTimeout(timeout)
  })

  const cache = []
  const sseRoomLimit = 100
  const getOrCreateSSERoom = (request) => {
    const htmlFileRelativeUrl = request.ressource.slice(1)
    const cacheEntry = cache.find(
      (cacheEntryCandidate) =>
        cacheEntryCandidate.htmlFileRelativeUrl === htmlFileRelativeUrl,
    )
    if (cacheEntry) {
      return cacheEntry.sseRoom
    }
    const sseRoom = createSSERoom({
      retryDuration: 2000,
      historyLength: 100,
      welcomeEventEnabled: true,
      effect: () => {
        const removeHotUpdateCallback = hotUpdateCallbackList.add(
          (hotUpdate) => {
            if (hotUpdate.declined) {
              sseRoom.sendEvent({
                type: "reload",
                data: JSON.stringify({
                  cause: hotUpdate.cause,
                  type: "full",
                  typeReason: hotUpdate.reason,
                  declinedBy: hotUpdate.declinedBy,
                }),
              })
            } else {
              sseRoom.sendEvent({
                type: "reload",
                data: JSON.stringify({
                  cause: hotUpdate.cause,
                  type: "hot",
                  typeReason: hotUpdate.reason,
                  hotInstructions: hotUpdate.instructions,
                }),
              })
            }
          },
        )
        return () => {
          removeHotUpdateCallback()
        }
      },
    })

    const removeSSECleanupCallback = destroyCallbackList.add(() => {
      removeSSECleanupCallback()
      sseRoom.close()
    })
    cache.push({
      htmlFileRelativeUrl,
      sseRoom,
      cleanup: () => {
        removeSSECleanupCallback()
        sseRoom.close()
      },
    })
    if (cache.length >= sseRoomLimit) {
      const firstCacheEntry = cache.shift()
      firstCacheEntry.cleanup()
    }
    return sseRoom
  }

  return {
    getOrCreateSSERoom,
    destroy: () => {
      destroyCallbackList.notify()
    },
  }
}
