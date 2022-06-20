import { createSSERoom } from "@jsenv/server"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"

export const createSSEService = ({ serverEventCallbackList }) => {
  const destroyCallbackList = createCallbackListNotifiedOnce()

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
        return serverEventCallbackList.add((event) => {
          sseRoom.sendEvent(event)
        })
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
