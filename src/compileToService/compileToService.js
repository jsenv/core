import {
  createRequestToFileResponse,
  convertFileSystemErrorToResponseProperties,
} from "../createRequestToFileResponse/index.js"
import { stat, readFile } from "../fileHelper.js"
import { dateToSecondsPrecision } from "../dateHelper.js"
import { createETag } from "./helpers.js"
import { compileFile } from "./compileFile.js"
import { ressourceToCompileInfo } from "./ressourceToCompileInfo.js"
import { watchFile } from "../watchFile.js"
import { createSignal } from "@dmail/signal"
import { acceptContentType, createSSERoom, serviceCompose } from "../server/index.js"
import { createCancellationToken } from "../cancellation/index.js"
import { hrefToOrigin, hrefToRessource } from "../urlHelper.js"
import { ressourceToLocateParam } from "./ressourceToLocateParam.js"

export const compileToService = (
  compile,
  {
    cancellationToken = createCancellationToken(),
    localRoot,
    compileInto,
    locate = ({ dependentFolder, file }) => {
      return dependentFolder ? `${dependentFolder}/${file}` : file
    },
    compileParamMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy = "etag",
    assetCacheStrategy = "etag",

    watch = false,
    watchPredicate = () => true,
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
  cancellationToken.register(() => {
    watchedFiles.forEach((closeWatcher) => closeWatcher())
    watchedFiles.clear()
  })

  const compileService = async ({ origin, ressource, method, headers = {}, body }) => {
    const { isAsset, compileId, file } = ressourceToCompileInfo(ressource, compileInto)

    // serve asset
    if (isAsset) {
      return fileService({ ressource, method, headers, body })
    }

    // we don't handle
    if (!compileId || !file) {
      return null
    }

    let dependentRessource
    const refererHeaderName = "x-module-referer" in headers ? "x-module-referer" : "referer"
    if (refererHeaderName in headers) {
      const referer = headers[refererHeaderName]

      try {
        const refererOrigin = hrefToOrigin(referer)
        if (refererOrigin === origin) {
          dependentRessource = hrefToRessource(referer)
        }
      } catch (e) {
        return {
          status: 400,
          reason: `${refererHeaderName} header is invalid`,
        }
      }
    }

    const localFile = await locate({
      localRoot,
      ...ressourceToLocateParam(ressource, dependentRessource, compileInto),
    })

    // a request to node_modules/package/node_modules/dependency/index.js
    // may be found at node_modules/dependency/index.js
    // or a request to node_modules/dependency/index.js
    // with referer node_modules/package/index.js
    // may be found at node_modules/package/node_modules/dependency/index.js
    // in that case, send temporary redirect to client
    if (localFile !== file) {
      return {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        status: 307,
        headers: {
          location: `${origin}/${compileInto}/${compileId}/${localFile}`,
        },
      }
    }

    const localFileAbsolute = `${localRoot}/${localFile}`

    // when I ask for a compiled file, watch the corresponding file on filesystem
    if (watch && watchedFiles.has(localFileAbsolute) === false && watchPredicate(localFile)) {
      const fileWatcher = watchFile(localFileAbsolute, () => {
        watchSignal.emit(file)
      })
      watchedFiles.set(localFileAbsolute, fileWatcher)
    }

    const compileService = async () => {
      const { output } = await compileFile({
        compile,
        localRoot,
        compileInto,
        compileId,
        compileParamMap,
        file,
        inputFile: localFileAbsolute,
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
        const { mtime } = await stat(localFileAbsolute)

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
        const content = await readFile(localFileAbsolute)
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
    cancellationToken.register(fileChangedSSE.close)

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
