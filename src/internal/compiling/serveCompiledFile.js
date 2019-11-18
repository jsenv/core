import { convertFileSystemErrorToResponseProperties } from "@jsenv/server"
import { urlToRelativeUrl, pathToFileUrl, resolveFileUrl } from "internal/urlUtils.js"
import { bufferToEtag } from "./compile-directory/bufferToEtag.js"
import { getOrGenerateCompiledFile } from "./compile-directory/getOrGenerateCompiledFile.js"

export const serveCompiledFile = async ({
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
}) => {
  if (writeOnFilesystem && compileCacheStrategy !== "etag" && compileCacheStrategy !== "mtime") {
    throw new Error(`compileCacheStrategy must be etag or mtime , got ${compileCacheStrategy}`)
  }

  const cacheWithETag = writeOnFilesystem && compileCacheStrategy === "etag"
  const { headers = {} } = request

  let ifEtagMatch
  if (cacheWithETag) {
    if ("if-none-match" in headers) {
      ifEtagMatch = headers["if-none-match"]
    }
  }

  const cacheWithMtime = writeOnFilesystem && compileCacheStrategy === "mtime"
  let ifModifiedSinceDate
  if (cacheWithMtime) {
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
    const { meta, compileResult, compileResultStatus } = await getOrGenerateCompiledFile({
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      ifEtagMatch,
      ifModifiedSinceDate,
      writeOnFilesystem,
      useFilesystemAsCache,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compile,
    })

    projectFileRequestedCallback({
      relativeUrl: urlToRelativeUrl(originalFileUrl, projectDirectoryUrl),
      request,
    })
    compileResult.sources.forEach((source) => {
      const sourceFileUrl = resolveFileUrl(source, `${compiledFileUrl}__asset__/`)
      projectFileRequestedCallback({
        relativeUrl: urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl),
        request,
      })
    })

    const { contentType, compiledSource } = compileResult

    if (cacheWithETag) {
      if (ifEtagMatch && compileResultStatus === "cached") {
        return {
          status: 304,
        }
      }
      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          eTag: bufferToEtag(Buffer.from(compiledSource)),
        },
        body: compiledSource,
      }
    }

    if (cacheWithMtime) {
      if (ifModifiedSinceDate && compileResultStatus === "cached") {
        return {
          status: 304,
        }
      }
      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "last-modified": new Date(meta.lastModifiedMs).toUTCString(),
        },
        body: compiledSource,
      }
    }

    return {
      status: 200,
      headers: {
        "content-length": Buffer.byteLength(compiledSource),
        "content-type": contentType,
        "cache-control": "no-store",
      },
      body: compiledSource,
    }
  } catch (error) {
    if (error && error.code === "PARSE_ERROR") {
      const relativeUrl = urlToRelativeUrl(pathToFileUrl(error.data.filename), projectDirectoryUrl)
      projectFileRequestedCallback({
        relativeUrl,
        request,
      })
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
