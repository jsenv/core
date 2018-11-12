import {
  createRequestToFileResponse,
  convertFileSystemErrorToResponseProperties,
} from "../createRequestToFileResponse/index.js"
import { stat, readFile } from "../fileHelper.js"
import { dateToSecondsPrecision } from "../dateHelper.js"
import { createETag } from "./helpers.js"
import { compileFile } from "./compileFile.js"
import { ressourceToCompileInfo } from "./requestToCompileInfo.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { acceptContentType, createSSERoom, serviceCompose } from "../server/index.js"
import { cancellationNone } from "../cancel/index.js"
import { hrefToOrigin, hrefToRessource } from "../urlHelper.js"
import path from "path"

export const compileToService = (
  compile,
  {
    cancellation = cancellationNone,
    localRoot,
    compileInto,
    locate = (file, localDependentFile) => `${localDependentFile}/${file}`,
    compileParamMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy = "etag",
    assetCacheStrategy = "etag",

    watch = false,
    watchPredicate = () => false,
  },
) => {
  const watchSignal = createSignal()
  const fileService = createRequestToFileResponse({
    root: localRoot,
    cacheStrategy: assetCacheStrategy,
  })

  const cacheWithMtime = cacheStrategy === "mtime"
  const cacheWithETag = cacheStrategy === "etag"
  const cachedDisabled = cacheStrategy === "none"

  const watchedFiles = new Map()
  cancellation.register(() => {
    watchedFiles.forEach((closeWatcher) => closeWatcher())
    watchedFiles.clear()
  })

  const compileService = async ({ origin, ressource, method, headers = {}, body }) => {
    let { isAsset, compileId, file } = ressourceToCompileInfo(ressource, compileInto)

    // serve asset
    if (isAsset) {
      return fileService({ ressource, method, headers, body })
    }

    // we don't handle
    if (!compileId || !file) {
      return null
    }

    let localFile
    const refererHeaderName = "x-module-referer" in headers ? "x-module-referer" : "referer"
    if (refererHeaderName in headers) {
      const referer = headers[refererHeaderName]

      let refererFile
      try {
        const refererOrigin = hrefToOrigin(referer)

        if (refererOrigin !== origin) {
          return {
            status: 400,
            reason: `${refererHeaderName} header origin must be ${origin}, got ${origin}`,
          }
        }

        const refererRessource = hrefToRessource(referer)
        const refererCompileInfo = ressourceToCompileInfo(refererRessource, compileInto)

        if (refererCompileInfo.compileId !== compileId) {
          return {
            status: 400,
            reason: `${refererHeaderName} header must be inside ${compileId}, got ${
              refererCompileInfo.compileId
            }`,
          }
        }

        refererFile = refererCompileInfo.file
        const refererFolder = path.dirname(refererFile)
        file = file.slice(`${refererFolder}/`.length)
      } catch (e) {
        return {
          status: 400,
          reason: `${refererHeaderName} header is invalid`,
        }
      }

      localFile = await locate(file, `${localRoot}/${refererFile}`)
    } else {
      localFile = await locate(file, localRoot)
    }

    // when I ask for a compiled file, watch the corresponding file on filesystem
    if (watch && watchedFiles.has(localFile) === false && watchPredicate(file)) {
      const fileWatcher = watchFile(localFile, () => {
        watchSignal.emit(file)
      })
      watchedFiles.set(localFile, fileWatcher)
    }

    const compileService = async () => {
      const { output } = await compileFile({
        compile,
        localRoot,
        compileInto,
        compileId,
        compileParamMap,
        file,
        inputFile: localFile,
        cacheStrategy: localCacheStrategy,
        cacheTrackHit: localCacheTrackHit,
      })

      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          "content-length": Buffer.byteLength(output),
          "content-type": "application/javascript",
        },
        body: output,
      }
    }

    try {
      if (cacheWithMtime) {
        const { mtime } = await stat(localFile)

        if ("if-modified-since" in headers) {
          const ifModifiedSince = headers["if-modified-since"]
          let ifModifiedSinceDate
          try {
            ifModifiedSinceDate = new Date(ifModifiedSince)
          } catch (e) {
            return {
              status: 400,
              reason: "if-modified-since header is not a valid date",
            }
          }

          if (ifModifiedSinceDate >= dateToSecondsPrecision(mtime)) {
            return {
              status: 304,
            }
          }
        }

        const response = await compileService()
        response.headers["last-modified"] = mtime.toUTCString()
        return response
      }

      if (cacheWithETag) {
        const content = await readFile(localFile)
        const eTag = createETag(content)

        if ("if-none-match" in headers) {
          const ifNoneMatch = headers["if-none-match"]

          if (ifNoneMatch === eTag) {
            return {
              status: 304,
            }
          }
        }

        const response = await compileService()
        response.headers.eTag = eTag
        return response
      }

      return compileService()
    } catch (error) {
      if (error && error.reason === "Unexpected directory operation") {
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
    cancellation.register(fileChangedSSE.close)

    watchSignal.listen((file) => {
      fileChangedSSE.sendEvent({
        type: "file-changed",
        data: file,
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
