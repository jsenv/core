// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

/* eslint-disable import/max-dependencies */
import { createRequestToFileResponse } from "../createRequestToFileResponse/index.js"
import {
  open as serverOpen,
  enableCORS,
  serviceCompose,
  acceptContentType,
  createSSERoom,
} from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { ressourceToCompileIdAndFile } from "../compileFileToService/compileFileToService.js"
import { createCancellable } from "../cancellable/index.js"

export const open = ({
  // server options
  protocol,
  ip,
  port,
  preventCors = false,

  localRoot,
  compileInto,
  compileService,

  // compile options
  watch = false,
  watchPredicate = () => false,
  watchSSE = true,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
}) => {
  const cancellable = createCancellable()

  const createWatchService = () => {
    const watchSignal = createSignal()

    const watchedFiles = new Map()
    cancellable.addCancellingTask(() => {
      watchedFiles.forEach((closeWatcher) => closeWatcher())
      watchedFiles.clear()
    })

    const watchService = (request) => {
      const { file } = ressourceToCompileIdAndFile(request.ressource, compileInto)
      if (!file) {
        return null
      }

      // when I ask for a compiled file, watch the corresponding file on filesystem
      const fileLocation = `${localRoot}/${file}`
      if (watchedFiles.has(fileLocation) === false && watchPredicate(file)) {
        const fileWatcher = watchFile(fileLocation, () => {
          watchSignal.emit(file)
        })
        watchedFiles.set(fileLocation, fileWatcher)
      }

      return null
    }

    const createWatchSSEService = () => {
      const fileChangedSSE = createSSERoom()

      fileChangedSSE.open()
      cancellable.addCancellingTask(fileChangedSSE.close())

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

  const service = serviceCompose(
    ...[
      ...(watch ? [createWatchService()] : []),
      (request) => {
        const { file } = ressourceToCompileIdAndFile(request.ressource, compileInto)
        if (!file) {
          return null
        }
        return compileService(request)
      },
      createRequestToFileResponse({
        root: localRoot,
        cacheIgnore: sourceCacheIgnore,
        cacheStrategy: sourceCacheStrategy,
      }),
    ],
  )

  const requestToResponse = (request) => {
    return service(request).then((response) => {
      return preventCors
        ? response
        : enableCORS(response, { allowedOrigins: [request.headers.origin] })
    })
  }

  return cancellable.map(
    serverOpen({
      protocol,
      ip,
      port,
      requestToResponse,
    }),
  )
}
