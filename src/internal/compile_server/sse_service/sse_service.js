import { createSSERoom } from "@jsenv/server"
import {
  resolveUrl,
  registerDirectoryLifecycle,
  urlToExtension,
  urlIsInsideOf,
  urlToRelativeUrl,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"
import { createCallbackList } from "@jsenv/abort"

import { urlIsCompilationAsset } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compile_asset.js"

export const createSSEService = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  livereloadSSE,
  projectFileRequestedSignal,

  serverStopCallbackList,
  livereloadLogLevel,
  livereloadWatchConfig,
}) => {
  let handleSSEClientRequest
  if (livereloadSSE) {
    handleSSEClientRequest = createSSEServiceWithLivereload({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      projectFileRequestedSignal,

      serverStopCallbackList,
      livereloadLogLevel,
      livereloadWatchConfig,
    })
  } else {
    const roomWhenLivereloadIsDisabled = createSSERoom()
    roomWhenLivereloadIsDisabled.open()
    handleSSEClientRequest = (request) => {
      return roomWhenLivereloadIsDisabled.join(request)
    }
  }
  return (request) => {
    const { accept } = request.headers
    if (!accept || !accept.includes("text/event-stream")) {
      return null
    }
    return handleSSEClientRequest(request)
  }
}

const createSSEServiceWithLivereload = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,

  projectFileRequestedSignal,
  serverStopCallbackList,
  livereloadLogLevel,
  livereloadWatchConfig,
}) => {
  const livereloadLogger = createLogger({ logLevel: livereloadLogLevel })
  const trackerMap = new Map()
  const projectFileRequested = createCallbackList()
  const projectFileModified = createCallbackList()
  const projectFileRemoved = createCallbackList()
  const projectFileAdded = createCallbackList()

  /**
   * projectFileRequestedCallback
   * This function will be called by the compile server every time a file inside projectDirectory
   * is requested so that we can build up the dependency tree of any file
   *
   */
  projectFileRequestedSignal.onrequested = (relativeUrl, request) => {
    if (relativeUrl[0] === "/") {
      relativeUrl = relativeUrl.slice(1)
    }
    const url = `${projectDirectoryUrl}${relativeUrl}`
    if (
      // Do not watch sourcemap files
      urlToExtension(url) === ".map" ||
      // Do not watch compilation asset, watching source file is enough
      urlIsCompilationAsset(url)
    ) {
      return
    }
    projectFileRequested.notify({ relativeUrl, request })
  }
  const watchDescription = {
    ...livereloadWatchConfig,
    [jsenvDirectoryRelativeUrl]: false,
  }
  // wait 100ms to actually start watching
  // otherwise server starting is delayed by the filesystem scan done in
  // registerDirectoryLifecycle
  const timeout = setTimeout(() => {
    const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
      projectDirectoryUrl,
      {
        watchDescription,
        updated: ({ relativeUrl }) => {
          projectFileModified.notify(relativeUrl)
        },
        removed: ({ relativeUrl }) => {
          projectFileRemoved.notify(relativeUrl)
        },
        added: ({ relativeUrl }) => {
          projectFileAdded.notify(relativeUrl)
        },
        keepProcessAlive: false,
        recursive: true,
      },
    )
    serverStopCallbackList.add(unregisterDirectoryLifecyle)
  }, 100)
  serverStopCallbackList.add(() => {
    clearTimeout(timeout)
  })

  const startTrackingRoot = (rootFile) => {
    stopTrackingRoot(rootFile)
    const set = new Set()
    set.add(rootFile)
    const depInfo = {
      set,
      cleanup: [],
    }
    trackerMap.set(rootFile, depInfo)
    return depInfo
  }
  const addStopTrackingCalback = (rootFile, callback) => {
    trackerMap.get(rootFile).cleanup.push(callback)
  }
  const stopTrackingRoot = (rootFile) => {
    const depInfo = trackerMap.get(rootFile)
    if (depInfo) {
      depInfo.cleanup.forEach((cb) => {
        cb()
      })
      trackerMap.delete(rootFile)
    }
  }
  const isDependencyOf = (file, rootFile) => {
    const depInfo = trackerMap.get(rootFile)
    return depInfo && depInfo.set.has(file)
  }
  const markAsDependencyOf = (file, rootFile) => {
    trackerMap.get(rootFile).set.add(file)
  }

  // each time a file is requested for the first time its dependencySet is computed
  projectFileRequested.add((requestInfo) => {
    const rootRelativeUrl = requestInfo.relativeUrl
    // for now no use case of livereloading on node.js
    // and for browsers only html file can be main files
    // this avoid collecting dependencies of non html files that will never be used
    if (!rootRelativeUrl.endsWith(".html")) {
      return
    }

    livereloadLogger.debug(`${rootRelativeUrl} requested -> start tracking it`)
    // when a file is requested, always rebuild its dependency in case it has changed
    // since the last time it was requested
    startTrackingRoot(rootRelativeUrl)

    const removeDependencyRequestedCallback = projectFileRequested.add(
      ({ relativeUrl, request }) => {
        if (isDependencyOf(relativeUrl, rootRelativeUrl)) {
          return
        }
        const dependencyReport = reportDependency(
          relativeUrl,
          rootRelativeUrl,
          request,
        )
        if (dependencyReport.dependency === false) {
          livereloadLogger.debug(
            `${relativeUrl} not a dependency of ${rootRelativeUrl} because ${dependencyReport.reason}`,
          )
          return
        }
        livereloadLogger.debug(
          `${relativeUrl} is a dependency of ${rootRelativeUrl} because ${dependencyReport.reason}`,
        )
        markAsDependencyOf(relativeUrl, rootRelativeUrl)
      },
    )
    addStopTrackingCalback(rootRelativeUrl, removeDependencyRequestedCallback)
    const removeRootRemovedCallback = projectFileRemoved.add((relativeUrl) => {
      if (relativeUrl === rootRelativeUrl) {
        stopTrackingRoot(rootRelativeUrl)
        livereloadLogger.debug(`${rootRelativeUrl} removed -> stop tracking it`)
      }
    })
    addStopTrackingCalback(rootRelativeUrl, removeRootRemovedCallback)
  })

  /**
   * trackMainAndDependencies
   * This function is meant to be used to implement server sent events in order for a client to know
   * when a given file or any of its dependencies changes in order to implement livereloading.
   * At any time this function can be called with (mainRelativeUrl, { modified, removed, lastEventId })
   * modified is called
   *  - immediatly if lastEventId is passed and mainRelativeUrl or any of its dependencies have
   *  changed since that event (last change is passed to modified if their is more than one change)
   *  - when mainRelativeUrl or any of its dependencies is modified
   * removed is called
   *  - with same spec as modified but when a file is deleted from the filesystem instead of modified
   */
  const trackMainAndDependencies = (
    mainRelativeUrl,
    { modified, removed, added },
  ) => {
    livereloadLogger.debug(`track ${mainRelativeUrl} and its dependencies`)

    const removeModifiedCallback = projectFileModified.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        modified(relativeUrl)
      }
    })
    const removeRemovedCallback = projectFileRemoved.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        removed(relativeUrl)
      }
    })
    const removeAddedCallback = projectFileAdded.add((relativeUrl) => {
      if (isDependencyOf(relativeUrl, mainRelativeUrl)) {
        added(relativeUrl)
      }
    })

    return () => {
      livereloadLogger.debug(
        `stop tracking ${mainRelativeUrl} and its dependencies.`,
      )
      removeModifiedCallback()
      removeRemovedCallback()
      removeAddedCallback()
    }
  }

  const reportDependency = (relativeUrl, mainRelativeUrl, request) => {
    if (relativeUrl === mainRelativeUrl) {
      return {
        dependency: true,
        reason: "it's main",
      }
    }

    if ("x-jsenv-execution-id" in request.headers) {
      const executionId = request.headers["x-jsenv-execution-id"]
      if (executionId === mainRelativeUrl) {
        return {
          dependency: true,
          reason: "x-jsenv-execution-id request header",
        }
      }
      return {
        dependency: false,
        reason: "x-jsenv-execution-id request header",
      }
    }

    const { referer } = request.headers
    if (referer) {
      // here we know the referer is inside compileServer
      const refererRelativeUrl = urlToOriginalRelativeUrl(
        referer,
        resolveUrl(jsenvDirectoryRelativeUrl, request.origin),
      )
      if (refererRelativeUrl) {
        // search if referer (file requesting this one) is tracked as being a dependency of main file
        // in that case because the importer is a dependency the importee is also a dependency
        // eslint-disable-next-line no-unused-vars
        for (const tracker of trackerMap) {
          if (
            tracker[0] === mainRelativeUrl &&
            tracker[1].set.has(refererRelativeUrl)
          ) {
            return {
              dependency: true,
              reason: "referer is a dependency",
            }
          }
        }
      }
    }

    return {
      dependency: true,
      reason: "it was requested",
    }
  }

  const cache = []
  const sseRoomLimit = 100
  const getOrCreateSSERoom = (mainFileRelativeUrl) => {
    const cacheEntry = cache.find(
      (cacheEntryCandidate) =>
        cacheEntryCandidate.mainFileRelativeUrl === mainFileRelativeUrl,
    )
    if (cacheEntry) {
      return cacheEntry.sseRoom
    }

    const sseRoom = createSSERoom({
      retryDuration: 2000,
      historyLength: 100,
      welcomeEventEnabled: true,
    })

    // each time something is modified or removed we send event to the room
    const stopTracking = trackMainAndDependencies(mainFileRelativeUrl, {
      modified: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-modified", data: relativeUrl })
      },
      removed: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-removed", data: relativeUrl })
      },
      added: (relativeUrl) => {
        sseRoom.sendEvent({ type: "file-added", data: relativeUrl })
      },
    })

    const removeSSECleanupCallback = serverStopCallbackList.add(() => {
      removeSSECleanupCallback()
      sseRoom.close()
      stopTracking()
    })
    cache.push({
      mainFileRelativeUrl,
      sseRoom,
      cleanup: () => {
        removeSSECleanupCallback()
        sseRoom.close()
        stopTracking()
      },
    })
    if (cache.length >= sseRoomLimit) {
      const firstCacheEntry = cache.shift()
      firstCacheEntry.cleanup()
    }
    return sseRoom
  }

  return (request) => {
    const requestUrl = resolveUrl(request.ressource, request.origin)
    const outDirectoryServerUrl = resolveUrl(
      jsenvDirectoryRelativeUrl,
      request.origin,
    )
    const originalRelativeUrl = urlToOriginalRelativeUrl(
      requestUrl,
      outDirectoryServerUrl,
    )
    const room = getOrCreateSSERoom(originalRelativeUrl)
    return room.join(request)
  }
}

const urlToOriginalRelativeUrl = (url, outDirectoryRemoteUrl) => {
  if (urlIsInsideOf(url, outDirectoryRemoteUrl)) {
    const afterCompileDirectory = urlToRelativeUrl(url, outDirectoryRemoteUrl)
    const fileRelativeUrl = afterCompileDirectory.slice(
      afterCompileDirectory.indexOf("/") + 1,
    )
    return fileRelativeUrl
  }
  return new URL(url).pathname.slice(1)
}
