import { createCancellationToken } from "@dmail/cancellation"
import { createSignal } from "@dmail/signal"
import { fileRead, fileStat } from "@dmail/helper"
import { convertFileSystemErrorToResponseProperties } from "../requestToFileResponse/index.js"
import { dateToSecondsPrecision } from "../dateHelper.js"
import { hrefToOrigin, hrefToRessource } from "../urlHelper.js"
import { acceptContentType, createSSERoom, serviceCompose } from "../server/index.js"
import { watchFile } from "../watchFile.js"
import { createETag } from "./helpers.js"
import { compileFile } from "./compileFile.js"
import { ressourceToCompileInfo } from "./ressourceToCompileInfo.js"
// eslint-disable-next-line import/max-dependencies
import { ressourceToLocateParam } from "./ressourceToLocateParam.js"

export const compileToService = (
  compile,
  {
    cancellationToken = createCancellationToken(),
    localRoot,
    compileInto,
    locate = locateDefault,
    compileParamMap,
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
    const { isAsset, compileId, file } = ressourceToCompileInfo(ressource, compileInto)

    // asset -> we don't compile asset
    if (isAsset) return null

    // no file -> nothing to compile
    if (!compileId || !file) return null

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
          statusText: `${refererHeaderName} header is invalid`,
        }
      }
    }

    // le chemin vers le fichier pour le client (qu'on peut modifier ce qui signifie un redirect)
    // le chemin vers le fichier sur le filesystem (qui peut etre different de localRoot/file)
    const fileAbsoluteLocation = await locate({
      localRoot,
      ressource,
      dependentRessource,
      compileParamMap,
      compileInto,
      compileId,
      ...ressourceToLocateParam({
        compileInto,
        ressource,
        dependentRessource,
      }),
    })

    // cannot locate a file -> we don't know what to compile
    if (!fileAbsoluteLocation) return null

    let fileLocated
    if (fileAbsoluteLocation.startsWith(`${localRoot}/`)) {
      fileLocated = fileAbsoluteLocation.slice(`${localRoot}/`.length)
    } else {
      fileLocated = file
    }

    // file must not be compiled (.html, .css, dist/browserLoader.js)
    if (!compilePredicate(fileLocated, fileAbsoluteLocation)) return null

    // a request to 'node_modules/package/node_modules/dependency/index.js'
    // may be found at 'node_modules/dependency/index.js'

    // a request to 'node_modules/dependency/index.js'
    // with referer 'node_modules/package/index.js'
    // may be found at 'node_modules/package/node_modules/dependency/index.js'
    if (fileLocated !== file) {
      // in that case, send temporary redirect to client
      return {
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
        status: 307,
        headers: {
          location: `${origin}/${compileInto}/${compileId}/${fileLocated}`,
        },
      }
    }

    // when I ask for a compiled file, watch the corresponding file on filesystem
    if (watch && watchedFiles.has(fileAbsoluteLocation) === false && watchPredicate(fileLocated)) {
      const fileWatcher = watchFile(fileAbsoluteLocation, () => {
        watchSignal.emit(file)
      })
      watchedFiles.set(fileAbsoluteLocation, fileWatcher)
    }

    const compileService = async () => {
      const { output } = await compileFile({
        compile,
        localRoot,
        compileInto,
        compileId,
        compileParamMap,
        file,
        fileAbsolute: fileAbsoluteLocation,
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
        const { mtime } = await fileStat(fileAbsoluteLocation)

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
            }
          }
        }

        const response = await compileService()
        response.headers["last-modified"] = mtime.toUTCString()
        return response
      }

      if (cacheWithETag) {
        const content = await fileRead(fileAbsoluteLocation)
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

export const locateDefault = ({ localRoot, file, dependentFolder }) => {
  return dependentFolder ? `${localRoot}/${dependentFolder}/${file}` : `${localRoot}/${file}`
}
