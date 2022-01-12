import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  resolveUrl,
  bufferToEtag,
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"

import { getOrGenerateCompiledFile } from "./compile-directory/getOrGenerateCompiledFile.js"
import { updateMeta } from "./compile-directory/updateMeta.js"

export const compileFile = async ({
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  projectFileRequestedCallback = () => {},
  request,
  responseHeaders = {},
  pushResponse,
  importmapInfos,
  compile,
  compileCacheStrategy,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
}) => {
  if (
    compileCacheStrategy !== "etag" &&
    compileCacheStrategy !== "mtime" &&
    compileCacheStrategy !== "none"
  ) {
    throw new Error(
      `compileCacheStrategy must be "etag", "mtime" or "none", got ${compileCacheStrategy}`,
    )
  }

  projectFileRequestedCallback(
    urlToRelativeUrl(originalFileUrl, projectDirectoryUrl),
    request,
  )

  const clientCacheDisabled = request.headers["cache-control"] === "no-cache"

  try {
    const { meta, compileResult, compileResultStatus, timing } =
      await getOrGenerateCompiledFile({
        logger,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        request,
        compileCacheStrategy,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        compile,
      })

    if (compileCacheStrategy === "etag" && !compileResult.compiledEtag) {
      // happens when file was just compiled so etag was not computed
      compileResult.compiledEtag = bufferToEtag(
        Buffer.from(compileResult.compiledSource),
      )
    }

    if (compileCacheStrategy === "mtime" && !compileResult.compiledMtime) {
      // happens when file was just compiled so it's not yet written on filesystem
      // Here we know the compiled file will be written on the filesystem
      // We could wait for the file to be written before responding to the client
      // but it could delay a bit the response.
      // Inside "updateMeta" the file might be written synchronously
      // or batched to be written later for perf reasons.
      // From this side of the code we would like to be agnostic about this to allow
      // eventual perf improvments in that field.
      // For this reason the "mtime" we send to the client is decided here
      // by "compileResult.compiledMtime = Date.now()"
      // "updateMeta" will respect this and when it will write the compiled file it will
      // use "utimes" to ensure the file mtime is the one we sent to the client
      // This is important so that a request sending an mtime
      // can be compared with the compiled file mtime on the filesystem
      // In the end etag is preffered over mtime by default so this will rarely
      // be useful
      compileResult.compiledMtime = Date.now()
    }

    const { contentType, compiledEtag, compiledMtime, compiledSource } =
      compileResult

    if (compileResult.responseHeaders) {
      responseHeaders = {
        ...responseHeaders,
        ...compileResult.responseHeaders,
      }
    }

    if (compileResultStatus !== "cached" && compileCacheStrategy !== "none") {
      // we MUST await updateMeta otherwise we might get 404
      // when serving sourcemap files
      await updateMeta({
        logger,
        meta,
        compileResult,
        compileResultStatus,
        compiledFileUrl,
        // originalFileUrl,
      })
    }

    compileResult.sources.forEach((source) => {
      const sourceFileUrl = resolveUrl(source, compiledFileUrl)
      projectFileRequestedCallback(
        urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl),
        request,
      )
    })

    if (request.http2) {
      const dependencyResolver = getDependencyResolver({
        compileResult,
        importmapInfos,
        request,
      })
      if (dependencyResolver) {
        compileResult.dependencies.forEach((dependency) => {
          const dependencyUrl = dependencyResolver.resolve(dependency)
          if (!urlIsInsideOf(dependencyUrl, request.origin)) {
            // ignore external urls
            return
          }
          if (dependencyUrl.startsWith("data:")) {
            return
          }
          const dependencyRelativeUrl = urlToRelativeUrl(
            dependencyUrl,
            request.origin,
          )
          pushResponse({ path: `/${dependencyRelativeUrl}` })
        })
      }
    }

    // when a compiled version of the source file was just created or updated
    // we don't want to rely on filesystem because we might want to delay
    // when the file is written for perf reasons
    // Moreover we already got the data in RAM
    const respondUsingRAM = (finalizeResponse = () => {}) => {
      const response = {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "cache-control": "no-store",
          ...responseHeaders,
        },
        body: compiledSource,
        timing,
      }
      finalizeResponse(response)
      return response
    }

    if (!clientCacheDisabled && compileCacheStrategy === "etag") {
      if (
        request.headers["if-none-match"] &&
        compileResultStatus === "cached"
      ) {
        return {
          status: 304,
          headers: {
            "cache-control": "private,max-age=0,must-revalidate",
          },
          timing,
        }
      }
      return respondUsingRAM((response) => {
        // eslint-disable-next-line dot-notation
        response.headers["etag"] = compiledEtag
        response.headers["cache-control"] = "private,max-age=0,must-revalidate"
      })
    }

    if (!clientCacheDisabled && compileCacheStrategy === "mtime") {
      if (
        request.headers["if-modified-since"] &&
        compileResultStatus === "cached"
      ) {
        return {
          status: 304,
          headers: {
            "cache-control": "private,max-age=0,must-revalidate",
          },
          timing,
        }
      }
      return respondUsingRAM((response) => {
        response.headers["last-modified"] = new Date(
          compiledMtime,
        ).toUTCString()
        response.headers["cache-control"] = "private,max-age=0,must-revalidate"
      })
    }

    return respondUsingRAM()
  } catch (error) {
    if (error && error.code === "PARSE_ERROR") {
      const { data } = error
      const { filename } = data
      if (filename) {
        const relativeUrl = urlToRelativeUrl(
          fileSystemPathToUrl(filename),
          projectDirectoryUrl,
        )
        projectFileRequestedCallback(relativeUrl, request)
      }
      // on the correspondig file
      const json = JSON.stringify(data)

      return {
        status: 500,
        statusText: "parse error",
        headers: {
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(json),
          "content-type": "application/json",
        },
        body: json,
      }
    }

    if (error && error.statusText === "Unexpected directory operation") {
      return {
        status: 403,
      }
    }

    return convertFileSystemErrorToResponseProperties(error)
  }
}

const getDependencyResolver = ({ compileResult, importmapInfos, request }) => {
  const importmapKeys = Object.keys(importmapInfos)
  const requestUrl = resolveUrl(request.ressource, request.origin)

  if (
    compileResult.contentType === "application/javascript" &&
    // we cannot trust importmapKeys because when html is restored from cache
    // it would be empty
    importmapKeys.length > 0
  ) {
    // js resolution is special, we cannot just do resolveUrl of the import specifier
    // because there can be importmap (bare specifier, import without extension, custom remapping, ...)
    // And we would push 404 to the browser
    // BUT I tried to push everything to the browser and it was a big fail:
    // server is trying to push streams but browser rejects most push streams
    // either because main file is already fetched or an other file request the same ressource
    return null
  }

  return {
    type: "url_resolution",
    resolve: (dependency) => {
      const dependencyUrl = resolveUrl(dependency, requestUrl)
      return dependencyUrl
    },
  }
}
