// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { createCompile } from "../createCompile/createCompile.js"
import { createFileService } from "../createFileService/index.js"
import {
  openServer,
  enableCORS,
  createResponseGenerator,
  acceptContentType,
  createSSERoom,
} from "../openServer/index.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { urlToPathname } from "../urlHelper.js"

const guard = (fn, shield) => (...args) => {
  return shield(...args) ? fn(...args) : undefined
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
  cacheDisabled = false,
  cacheTrackHit = false,
  // compile options
  root,
  into,
  cors = true,
  transpile = true,
  sourceMap = "comment", // can be "comment", "inline", "none"
  sourceURL = true,
  minify = false,
  optimize = false,
  instrument = false,
  instrumentPredicate = () => false,
}) => {
  const cleanup = createSignal()

  return Promise.resolve().then(() => {
    const watchSignal = createSignal()

    const createWatchService = () => {
      const watchedFiles = new Map()
      cleanup.listenOnce(() => {
        watchedFiles.forEach((closeWatcher) => closeWatcher())
        watchedFiles.clear()
      })

      return ({ url }) => {
        let relativeFilename = urlToPathname(url).slice(1)
        const dirname = relativeFilename.slice(0, relativeFilename.indexOf("/"))
        if (dirname === into) {
          // when I ask for a compiled file, watch the corresponding file on filesystem
          relativeFilename = relativeFilename.slice(into.length + 1)
        }

        const filename = `${root}/${relativeFilename}`

        if (watchedFiles.has(filename) === false && watchPredicate(relativeFilename)) {
          const fileWatcher = watchFile(filename, () => {
            watchSignal.emit(relativeFilename)
          })
          watchedFiles.set(url, fileWatcher)
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

    let compileFileFromCompileService
    const createCompileServiceCustom = () => {
      const compile = createCompile({
        instrumentPredicate,
        createOptions: () => {
          // we should use a token or something to prevent a browser from being taken for nodejs
          // because will have security impact as we are going to trust this
          // const isNodeClient =
          //   request.headers.has("user-agent") &&
          //   request.headers.get("user-agent").startsWith("node-fetch")

          const remap = sourceMap === "comment" || sourceMap === "inline"
          const remapMethod = sourceMap

          const identify = sourceURL
          const identifyMethod = "relative"

          return {
            identify,
            identifyMethod,
            transpile,
            instrument,
            remap,
            remapMethod,
            minify,
            optimize,
          }
        },
      })

      const { service: compileService, compileFile } = createCompileService({
        rootLocation: root,
        cacheFolderRelativeLocation: into,
        abstractFolderRelativeLocation: into,
        compile,
        cacheDisabled,
        cacheTrackHit,
      })
      compileFileFromCompileService = compileFile

      return guard(compileService, ({ method, url }) => {
        if (method !== "GET" && method !== "HEAD") {
          return false
        }

        const pathname = urlToPathname(url)
        // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
        const filename = pathname.slice(1)
        const dirname = filename.slice(0, filename.indexOf("/"))

        if (dirname !== into) {
          return false
        }

        return true
      })
    }

    const services = [
      ...(watch ? [createWatchService(), createFileChangedSSEService()] : []),
      createCompileServiceCustom(),
      createFileService({
        root,
      }),
    ]

    const responseGenerator = createResponseGenerator(...services)

    const getResponseForRequest = (request) => {
      return responseGenerator(request).then((response) => {
        return cors ? enableCORS(request, response) : response
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
        compileFile: compileFileFromCompileService,
        watchSignal,
      }
    })
  })
}
