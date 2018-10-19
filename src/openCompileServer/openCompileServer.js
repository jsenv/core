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
import { ressourceToCompileIdAndFile } from "../compileFileToService/compileFileToService.js"

// hum je pense qu'en fait il vaudrait mieux donner la possibilité
// a jsCompileService de watch ses fichiers
// le client ouvrira un sse sur le js qu'on compile et redemarre
// si y'a du JSON par exemple
// on voudrait restart aussi
// donc on a bien une sorte de service par default
// qui watch et restart, ou alors il faudrait que ce soit explicite pour les fichiers
// non js
// en fonction des services qu'on a demarre le client se connecte differement au serveur
// en modifiant le code qu'on lui sers
// mais tout ca devient complexe

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

  // generic compile options
  root,
  into,

  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,

  compileService,
}) => {
  const cleanup = createSignal()

  const watchSignal = createSignal()

  const createWatchService = () => {
    const watchedFiles = new Map()
    cleanup.listenOnce(() => {
      watchedFiles.forEach((closeWatcher) => closeWatcher())
      watchedFiles.clear()
    })

    return ({ ressource }) => {
      const { file } = ressourceToCompileIdAndFile(ressource, into)
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

  const service = serviceCompose(
    ...[
      ...(watch ? [createWatchService(), createFileChangedSSEService()] : []),
      compileService,
      createRequestToFileResponse({
        root,
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

  return openServer({
    protocol,
    ip,
    port,
    autoCloseOnExit,
    autoCloseOnCrash,
    autoCloseOnError,
    requestToResponse,
  }).then((server) => {
    server.closed.listenOnce(cleanup.emit)

    return {
      ...server,
      watchSignal,
    }
  })
}
