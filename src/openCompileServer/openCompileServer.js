// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { createRequestToFileResponse } from "../createRequestToFileResponse/index.js"
import {
  open,
  enableCORS,
  serviceCompose,
  acceptContentType,
  createSSERoom,
} from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { ressourceToCompileIdAndFile } from "../compileFileToService/compileFileToService.js"

export const openCompileServer = ({
  // server options
  protocol,
  ip,
  port,
  watch = false,
  watchPredicate = () => false,
  watchSSE = true,
  preventCors = false,

  // generic compile options
  LOCAL_ROOT,
  COMPILE_INTO,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,

  // the compile service
  compileService,
}) => {
  const cleanup = createSignal()

  const createWatchService = () => {
    const watchSignal = createSignal()

    const watchedFiles = new Map()
    cleanup.listenOnce(() => {
      watchedFiles.forEach((closeWatcher) => closeWatcher())
      watchedFiles.clear()
    })

    const watchService = (request) => {
      const { file } = ressourceToCompileIdAndFile(request.ressource, COMPILE_INTO)
      // when I ask for a compiled file, watch the corresponding file on filesystem
      const fileLocation = `${LOCAL_ROOT}/${file}`
      if (watchedFiles.has(fileLocation) === false && watchPredicate(file)) {
        const fileWatcher = watchFile(fileLocation, () => {
          watchSignal.emit(file)
        })
        watchedFiles.set(fileLocation, fileWatcher)
      }
    }

    const createWatchSSEService = () => {
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

    if (watchSSE) {
      return serviceCompose(watchService, createWatchSSEService())
    }
    return watchService
  }

  if (watch) {
    compileService = serviceCompose(createWatchService(), compileService)
  }

  const wrappedCompileService = (request) => {
    const { file } = ressourceToCompileIdAndFile(request.ressource, COMPILE_INTO)
    if (!file) {
      return null
    }
    return compileService(request)
  }

  const sourceService = createRequestToFileResponse({
    root: LOCAL_ROOT,
    cacheIgnore: sourceCacheIgnore,
    cacheStrategy: sourceCacheStrategy,
  })

  const service = serviceCompose(wrappedCompileService, sourceService)

  const requestToResponse = (request) => {
    return service(request).then((response) => {
      return preventCors
        ? response
        : enableCORS(response, { allowedOrigins: [request.headers.origin] })
    })
  }

  return open({
    protocol,
    ip,
    port,
    requestToResponse,
  }).then((server) => {
    server.closed.listenOnce(cleanup.emit)

    return server
  })
}
