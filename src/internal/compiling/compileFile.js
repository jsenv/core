import {
  serveFile,
  convertFileSystemErrorToResponseProperties,
} from "@jsenv/server"
import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  resolveUrl,
  bufferToEtag,
} from "@jsenv/filesystem"
import { getOrGenerateCompiledFile } from "./compile-directory/getOrGenerateCompiledFile.js"

export const compileFile = async ({
  // cancellatioToken,
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  fileContentFallback,
  projectFileRequestedCallback = () => {},
  request,
  compile,
  writeOnFilesystem,
  useFilesystemAsCache,
  compileCacheStrategy = "etag",
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
}) => {
  if (
    writeOnFilesystem &&
    compileCacheStrategy !== "etag" &&
    compileCacheStrategy !== "mtime"
  ) {
    throw new Error(
      `compileCacheStrategy must be etag or mtime , got ${compileCacheStrategy}`,
    )
  }

  const { headers = {} } = request
  const clientCacheDisabled = headers["cache-control"] === "no-cache"
  const cacheWithETag = writeOnFilesystem && compileCacheStrategy === "etag"

  let ifEtagMatch
  if (cacheWithETag && "if-none-match" in headers) {
    ifEtagMatch = headers["if-none-match"]
  }

  const cacheWithMtime = writeOnFilesystem && compileCacheStrategy === "mtime"
  let ifModifiedSinceDate
  if (cacheWithMtime && "if-modified-since" in headers) {
    const ifModifiedSince = headers["if-modified-since"]
    try {
      ifModifiedSinceDate = new Date(ifModifiedSince)
    } catch (e) {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date",
      }
    }
  }

  try {
    const { compileResult, compileResultStatus, timing } =
      await getOrGenerateCompiledFile({
        logger,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        fileContentFallback,
        ifEtagMatch,
        ifModifiedSinceDate,
        writeOnFilesystem,
        useFilesystemAsCache,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        compile,
      })

    compileResult.sources.forEach((source) => {
      const sourceFileUrl = resolveUrl(source, compiledFileUrl)
      projectFileRequestedCallback(
        urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl),
        request,
      )
    })

    const { contentType, compiledEtag, compiledMtime, compiledSource } =
      compileResult

    // For now there is no reason to prefer the filesystem over the data we would have in RAM
    // but I would like to try to put validateMeta.js in a worker
    // If I do so, this file should minimize the input/output data transfered
    // so it would not return the "compiledSource"
    const respondUsingFileSystem = async (finalizeResponse = () => {}) => {
      const response = await serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
      })
      response.headers["content-type"] = contentType
      response.timing = { ...timing, ...response.timing }
      finalizeResponse(response)
      return response
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
        },
        body: compiledSource,
        timing,
      }
      finalizeResponse(response)
      return response
    }

    if (cacheWithETag && !clientCacheDisabled) {
      if (compileResultStatus === "cached") {
        if (ifEtagMatch) {
          return {
            status: 304,
            timing,
          }
        }
        return respondUsingFileSystem((response) => {
          // eslint-disable-next-line dot-notation
          response.headers["etag"] = compiledEtag
        })
      }
      // a compiled version of the source file was just created or updated
      // we don't want to rely on filesystem because we might want to delay
      // when the file is written for perf reasons
      // Moreover we already got the data in RAM
      return respondUsingRAM((response) => {
        // eslint-disable-next-line dot-notation
        response.headers["etag"] = bufferToEtag(Buffer.from(compiledSource))
      })
    }

    if (cacheWithMtime && !clientCacheDisabled) {
      if (compileResultStatus === "cached") {
        if (ifModifiedSinceDate) {
          return {
            status: 304,
            timing,
          }
        }
        return respondUsingFileSystem((response) => {
          response.headers["last-modified"] = compiledMtime
        })
      }

      return respondUsingRAM((response) => {
        response.headers["last-modified"] = new Date().toUTCString()
      })
    }

    if (compileResultStatus === "cached") {
      return respondUsingFileSystem()
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
