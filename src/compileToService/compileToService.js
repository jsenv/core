import {
  createRequestToFileResponse,
  convertFileSystemErrorToResponseProperties,
} from "../createRequestToFileResponse/index.js"
import { stat, readFile } from "../fileHelper.js"
import { dateToSecondsPrecision } from "../dateHelper.js"
import { createETag } from "./helpers.js"
import { compileFile } from "./compileFile.js"

export const ressourceToCompileIdAndFile = (ressource, into) => {
  const parts = ressource.split("/")
  const firstPart = parts[0]

  if (firstPart !== into) {
    return {}
  }

  const compileId = parts[1]
  if (compileId.length === 0) {
    return {}
  }

  const file = parts.slice(2).join("/")
  if (file.length === 0) {
    return {}
  }

  if (file.match(/[^\/]+__meta__\/.+$/)) {
    return {
      compileId,
      asset: file,
    }
  }

  return {
    compileId,
    file,
  }
}

export const compileToService = (
  compile,
  {
    localRoot,
    compileInto,
    locate = (file, root) => `${root}/${file}`,
    compileParamMap,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy = "etag",
    assetCacheStrategy = "etag",
  },
) => {
  const fileService = createRequestToFileResponse({
    root: localRoot,
    cacheStrategy: assetCacheStrategy,
  })

  const cacheWithMtime = cacheStrategy === "mtime"
  const cacheWithETag = cacheStrategy === "etag"
  const cachedDisabled = cacheStrategy === "none"

  return async ({ ressource, method, headers = {}, body }) => {
    const { compileId, file } = ressourceToCompileIdAndFile(ressource, compileInto)

    // no compileId or no asset we server the file without compiling it
    if (!compileId || !file) {
      return fileService({ ressource, method, headers, body })
    }

    const inputFile = await locate(file, localRoot)

    const compileService = async () => {
      const { output } = await compileFile({
        compile,
        localRoot,
        compileInto,
        compileId,
        compileParamMap,
        file,
        inputFile,
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
        const { mtime } = await stat(inputFile)

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
        const content = await readFile(inputFile)
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
}
