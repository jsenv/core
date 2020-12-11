import { convertFileSystemErrorToResponseProperties } from "@jsenv/server"
import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  resolveUrl,
  bufferToEtag,
  readFileSystemNodeModificationTime,
} from "@jsenv/util"
import { getOrGenerateCompiledFile } from "./compile-directory/getOrGenerateCompiledFile.js"

export const compileFile = async ({
  // cancellatioToken,
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  projectFileRequestedCallback = () => {},
  request,
  compile,
  writeOnFilesystem,
  useFilesystemAsCache,
  compileCacheStrategy = "etag",
  serverCompileCacheHitTracking = false,
  serverCompileCacheInterProcessLocking = false,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
}) => {
  if (writeOnFilesystem && compileCacheStrategy !== "etag" && compileCacheStrategy !== "mtime") {
    throw new Error(`compileCacheStrategy must be etag or mtime , got ${compileCacheStrategy}`)
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
    const { compileResult, compileResultStatus, timing } = await getOrGenerateCompiledFile({
      logger,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      ifEtagMatch,
      ifModifiedSinceDate,
      writeOnFilesystem,
      useFilesystemAsCache,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compileCacheSourcesValidation,
      compileCacheAssetsValidation,
      compile,
    })

    projectFileRequestedCallback(urlToRelativeUrl(originalFileUrl, projectDirectoryUrl), request)
    compileResult.sources.forEach((source) => {
      const sourceFileUrl = resolveUrl(source, compiledFileUrl)
      projectFileRequestedCallback(urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl), request)
    })

    const { contentType, compiledSource } = compileResult

    if (cacheWithETag && !clientCacheDisabled) {
      if (ifEtagMatch && compileResultStatus === "cached") {
        return {
          status: 304,
          timing,
        }
      }
      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "etag": bufferToEtag(Buffer.from(compiledSource)),
        },
        body: compiledSource,
        timing,
      }
    }

    if (cacheWithMtime && !clientCacheDisabled) {
      if (ifModifiedSinceDate && compileResultStatus === "cached") {
        return {
          status: 304,
          timing,
        }
      }
      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "last-modified": new Date(
            await readFileSystemNodeModificationTime(compiledFileUrl),
          ).toUTCString(),
        },
        body: compiledSource,
        timing,
      }
    }

    return {
      status: 200,
      headers: {
        "content-length": Buffer.byteLength(compiledSource),
        "content-type": contentType,
      },
      body: compiledSource,
      timing,
    }
  } catch (error) {
    if (error && error.code === "PARSE_ERROR") {
      const relativeUrl = urlToRelativeUrl(
        fileSystemPathToUrl(error.data.filename),
        projectDirectoryUrl,
      )
      projectFileRequestedCallback(relativeUrl, request)
      // on the correspondig file
      const json = JSON.stringify(error.data)

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
