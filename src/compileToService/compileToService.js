/* eslint-disable import/max-dependencies */
import { createCancellationToken } from "@dmail/cancellation"
import { createSignal } from "@dmail/signal"
import { fileRead, fileStat } from "@dmail/helper"
import { convertFileSystemErrorToResponseProperties } from "../requestToFileResponse/index.js"
import { dateToSecondsPrecision } from "../dateHelper.js"
import { acceptContentType, createSSERoom, serviceCompose } from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { originToHostname } from "../urlHelper.js"
import { createETag } from "./helpers.js"
import { compileFile } from "./compileFile.js"
import { locate as locateDefault } from "./locate.js"

const pathnameIsAsset = (pathname) => pathname.match(/[^\/]+__asset__\/.+$/)

export const compileToService = (
  compile,
  {
    cancellationToken = createCancellationToken(),
    projectFolder,
    compileInto,
    locate = locateDefault,
    compileDescription,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy = "etag",

    compilePredicate = () => true,

    watch = false,
    watchPredicate = () => true,
  },
) => {
  const watchSignal = createSignal()

  const cacheWithMtime = cacheStrategy === "mtime"
  const cacheWithETag = cacheStrategy === "etag"
  const cachedDisabled = cacheStrategy === "none"

  const watchedFiles = new Map()
  cancellationToken.register(() => {
    watchedFiles.forEach((closeWatcher) => closeWatcher())
    watchedFiles.clear()
  })

  const compileService = async ({ origin, ressource, headers = {} }) => {
    const compileId = originToCompileId({ origin, compileDescription })
    if (!compileId) return null

    const refererHeaderName = "x-module-referer" in headers ? "x-module-referer" : "referer"
    const requestReferer = refererHeaderName in headers ? headers[refererHeaderName] : ""

    if (requestReferer && !requestReferer.startsWith(origin)) {
      return { status: 400, statusText: `referer origin must be inside ${origin}` }
    }

    const requestPathname = ressource
    const unlocatedFilenameRelative = ressource.slice(1)

    if (pathnameIsAsset(unlocatedFilenameRelative)) return null

    const { filename } = await locate({
      projectFolder,
      refererPathname: requestReferer ? requestReferer.slice(origin.length) : "",
      requestPathname,
    })

    // cannot locate a file -> we don't know what to compile
    if (!filename) return null

    // we don't want to read anything outside of the project
    if (fileIsOutsideFolder(filename, projectFolder)) {
      return { status: 403, statusText: `cannot access file outside project` }
    }

    const filenameRelative = filename.slice(projectFolder.length + 1)
    // a request to 'node_modules/dependency/index.js'
    // with referer 'node_modules/package/index.js'
    // may be found at 'node_modules/package/node_modules/dependency/index.js'
    if (filenameRelative !== unlocatedFilenameRelative) {
      // in that case, send temporary redirect to client
      return {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        status: 307,
        headers: {
          vary: refererHeaderName,
          location: `${origin}/${filenameRelative}`,
        },
      }
    }

    // some file must not be compiled (.html, .css, dist/browserLoader.js)
    if (!compilePredicate(filenameRelative, filename)) return null

    // when I ask for a compiled file, watch the corresponding file on filesystem
    if (watch && watchedFiles.has(filename) === false && watchPredicate(filenameRelative)) {
      const fileWatcher = watchFile(filename, () => {
        watchSignal.emit(filenameRelative)
      })
      watchedFiles.set(filename, fileWatcher)
    }

    const compileService = async () => {
      const { output } = await compileFile({
        compile,
        projectFolder,
        compileInto,
        compileId,
        compileDescription,
        filenameRelative,
        filename,
        cacheStrategy: localCacheStrategy,
        cacheTrackHit: localCacheTrackHit,
      })

      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : { vary: refererHeaderName }),
          "content-length": Buffer.byteLength(output),
          "content-type": "application/javascript",
        },
        body: output,
      }
    }

    try {
      if (cacheWithMtime) {
        const { mtime } = await fileStat(filename)

        if ("if-modified-since" in headers) {
          const ifModifiedSince = headers["if-modified-since"]
          let ifModifiedSinceDate
          try {
            ifModifiedSinceDate = new Date(ifModifiedSince)
          } catch (e) {
            return {
              status: 400,
              statusText: "if-modified-since header is not a valid date",
            }
          }

          if (ifModifiedSinceDate >= dateToSecondsPrecision(mtime)) {
            return {
              status: 304,
              headers: { vary: refererHeaderName },
            }
          }
        }

        const response = await compileService()
        response.headers["last-modified"] = mtime.toUTCString()
        return response
      }

      if (cacheWithETag) {
        const content = await fileRead(filename)
        const eTag = createETag(content)

        if ("if-none-match" in headers) {
          const ifNoneMatch = headers["if-none-match"]

          if (ifNoneMatch === eTag) {
            return {
              status: 304,
              headers: { vary: refererHeaderName },
            }
          }
        }

        const response = await compileService()
        response.headers.eTag = eTag
        return response
      }

      return compileService()
    } catch (error) {
      if (error && error.statusText === "Unexpected directory operation") {
        return {
          status: 403,
        }
      }
      if (error && error.code === "CACHE_CORRUPTION_ERROR") {
        return {
          status: 500,
        }
      }
      return convertFileSystemErrorToResponseProperties(error)
    }
  }

  const createWatchSSEService = () => {
    const fileChangedSSE = createSSERoom()

    fileChangedSSE.open()
    cancellationToken.register(fileChangedSSE.close)

    watchSignal.listen((filename) => {
      fileChangedSSE.sendEvent({
        type: "file-changed",
        data: filename,
      })
    })

    return ({ headers }) => {
      if (acceptContentType(headers.accept, "text/event-stream")) {
        return fileChangedSSE.connect(headers["last-event-id"])
      }
      return null
    }
  }

  if (watch) {
    return serviceCompose(createWatchSSEService(), compileService)
  }

  return compileService
}

const originToCompileId = ({ origin, compileDescription }) => {
  const hostname = originToHostname(origin)
  const firstLowerLevelDomain = hostname.split(".")[0]
  return firstLowerLevelDomain in compileDescription ? firstLowerLevelDomain : null
}

const fileIsInsideFolder = (filename, folder) => filename.startsWith(`${folder}/`)

const fileIsOutsideFolder = (filename, folder) => !fileIsInsideFolder(filename, folder)
