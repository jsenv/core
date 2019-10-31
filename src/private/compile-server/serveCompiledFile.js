import { fileUrlToRelativePath, pathToFileUrl } from "../urlUtils.js"
import { getOrGenerateCompiledFile } from "../getOrGenerateCompiledFile/getOrGenerateCompiledFile.js"

const { bufferToEtag, convertFileSystemErrorToResponseProperties } = import.meta.require(
  "@dmail/server",
)

export const serveCompiledFile = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  relativePathToProjectDirectory,
  relativePathToCompileDirectory,
  projectFileRequestedCallback = () => {},
  request,
  compile,
  clientCompileCacheStrategy = "etag",
  serverCompileCacheHitTracking = false,
  serverCompileCacheInterProcessLocking = false,
}) => {
  if (
    clientCompileCacheStrategy !== "etag" &&
    clientCompileCacheStrategy !== "mtime" &&
    clientCompileCacheStrategy !== "none"
  ) {
    throw new Error(
      `clientCompileCacheStrategy must be etag, mtime or none, got ${clientCompileCacheStrategy}`,
    )
  }

  const cacheWithETag = clientCompileCacheStrategy === "etag"
  const { headers = {} } = request

  let ifEtagMatch
  if (cacheWithETag) {
    if ("if-none-match" in headers) {
      ifEtagMatch = headers["if-none-match"]
    }
  }

  const cacheWithMtime = clientCompileCacheStrategy === "mtime"
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

  const cache = clientCompileCacheStrategy !== "none"

  try {
    const { meta, compileResult, compileResultStatus } = await getOrGenerateCompiledFile({
      projectDirectoryUrl,
      compileDirectoryUrl,
      relativePathToProjectDirectory,
      relativePathToCompileDirectory,
      ifEtagMatch,
      ifModifiedSinceDate,
      cache,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compile,
    })

    projectFileRequestedCallback({
      relativePath: relativePathToProjectDirectory,
      request,
    })
    compileResult.sources.forEach((source) => {
      projectFileRequestedCallback({
        relativePath: source,
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
      const relativePath = fileUrlToRelativePath(
        pathToFileUrl(error.data.filename),
        projectDirectoryUrl,
      )
      projectFileRequestedCallback({
        relativePath,
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
