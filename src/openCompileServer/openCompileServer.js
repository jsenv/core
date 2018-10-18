// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { createRequestToFileResponse } from "../createRequestToFileResponse/index.js"
import {
  openServer,
  enableCORS,
  serviceCompose,
  acceptContentType,
  createSSERoom,
} from "../openServer/index.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { jsCreateCompileService } from "../jsCreateCompileService/jsCreateCompileService.js"
import { getGroupData, DEFAULT_GROUP_ID } from "./getGroupData.js"
import { getPlatformNameAndVersionFromHeaders } from "./getPlatformNameAndVersionFromHeaders.js"
import { getPluginsFromNames } from "@dmail/project-structure-compile-babel"
import { platformMatchCompatMap } from "./createCompileProfiles/index.js"
import { ressourceToGroupAndFile } from "../compileFileToService/compileFileToService.js"

const requestToGroupId = (groupData, request) => {
  const { platformName, platformVersion } = getPlatformNameAndVersionFromHeaders(request.headers)

  const groupId =
    Object.keys(groupData).find((id) => {
      const { compatMap } = groupData[id]
      return platformMatchCompatMap({ compatMap, platformName, platformVersion })
    }) || DEFAULT_GROUP_ID

  return groupId
}

const groupIdToParam = (groupData, groupId) => {
  return {
    plugins: getPluginsFromNames(groupData[groupId].pluginNames),
  }
}

export const openCompileServer = ({
  // server options
  protocol,
  ip,
  port,
  autoCloseOnExit,
  autoCloseOnCrash,
  autoCloseOnError,
  watch = false,
  watchPredicate = () => false,
  preventCors = false,
  cacheIgnore = false,

  // generic compile options
  root,
  into,
  compiledCacheTrackHit = false,
  compiledCacheStrategy = "etag",
  assetCacheStrategy = "etag",
  assetCacheIgnore = false,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,

  // js compile options
  // bon ce truc est relou, en gros pour lui il faut l4instancier d'une maiere speciale
  // pour pas qu'il instrumente tout
  instrumentPredicate,
}) => {
  const cleanup = createSignal()

  return getGroupData().then((groupData) => {
    const groupMap = Object.keys(groupData).map((id) => groupIdToParam(id))

    const watchSignal = createSignal()

    const createWatchService = () => {
      const watchedFiles = new Map()
      cleanup.listenOnce(() => {
        watchedFiles.forEach((closeWatcher) => closeWatcher())
        watchedFiles.clear()
      })

      return ({ ressource }) => {
        const { file } = ressourceToGroupAndFile(ressource, into, groupMap)
        if (!file) {
          return
        }

        // when I ask for a compiled file, watch the corresponding file on filesystem
        const fileLocation = `${root}/${file}`
        if (watchedFiles.has(fileLocation) === false && watchPredicate(file)) {
          const fileWatcher = watchFile(fileLocation, () => {
            watchSignal.emit(file)
          })
          watchedFiles.set(fileLocation, fileWatcher)
        }
      }
    }

    const createFileChangedSSEService = () => {
      const fileChangedSSE = createSSERoom()

      fileChangedSSE.open()
      cleanup.listenOnce(() => {
        fileChangedSSE.close()
      })

      watchSignal.listen((relativeFilename) => {
        fileChangedSSE.sendEvent({
          type: "file-changed",
          data: relativeFilename,
        })
      })

      return ({ headers }) => {
        if (acceptContentType(headers.accept, "text/event-stream")) {
          return fileChangedSSE.connect(headers["last-event-id"])
        }
        return null
      }
    }

    const createBalanceService = () => {
      return (request) => {
        if (request.ressource !== `${into}`) {
          return null
        }

        const group = JSON.stringify(requestToGroupId(request))

        return {
          headers: {
            // vary by user-agent because we use it to provided different file
            vary: "User-Agent",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(group),
          },
          body: group,
        }
      }
    }

    const service = serviceCompose(
      ...[
        createBalanceService(),
        ...(watch ? [createWatchService(), createFileChangedSSEService()] : []),
        jsCreateCompileService({
          root,
          into,
          groupMap,
          cacheIgnore,
          cacheTrackHit: compiledCacheTrackHit,
          cacheStrategy: compiledCacheStrategy,
          assetCacheIgnore,
          assetCacheStrategy,
          instrumentPredicate,
        }),
        createRequestToFileResponse({
          root,
          cacheIgnore: sourceCacheIgnore,
          cacheStrategy: sourceCacheStrategy,
        }),
      ],
    )

    const getResponseForRequest = (request) => {
      return service(request).then((response) => {
        return preventCors
          ? response
          : enableCORS(response, { allowedOrigins: [request.headers.origin] })
      })
    }

    return openServer({
      protocol,
      ip,
      port,
      autoCloseOnExit,
      autoCloseOnCrash,
      autoCloseOnError,
      getResponseForRequest,
    }).then((server) => {
      server.closed.listenOnce(cleanup.emit)

      return {
        ...server,
        watchSignal,
      }
    })
  })
}
