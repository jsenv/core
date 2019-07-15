import { convertFileSystemErrorToResponseProperties } from "@dmail/server"
import { createETag } from "../createETag.js"
import { getOrGenerateCompiledFile } from "./get-or-generate-compiled-file.js"

export const serveCompiledFile = async ({
  projectPathname,
  sourceRelativePath,
  compileRelativePath,
  projectFileRequestedCallback = () => {},
  headers,
  compile,
  clientCompileCacheStrategy = "etag",
  serverCompileCacheHitTracking = false,
  serverCompileCacheInterProcessLocking = false,
}) => {
  if (
    clientCompileCacheStrategy !== "etag" &&
    clientCompileCacheStrategy !== "mtime" &&
    clientCompileCacheStrategy !== "none"
  )
    throw new Error(
      `clientCompileCacheStrategy must be etag, mtime or none, got ${clientCompileCacheStrategy}`,
    )

  const cacheWithETag = clientCompileCacheStrategy === "etag"

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

  const cacheIgnored = clientCompileCacheStrategy === "none"

  try {
    const { cache, compileResult, compileResultStatus } = await getOrGenerateCompiledFile({
      projectPathname,
      sourceRelativePath,
      compileRelativePath,
      ifEtagMatch,
      ifModifiedSinceDate,
      cacheIgnored,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compile,
    })

    compileResult.sources.forEach((source) => {
      projectFileRequestedCallback({
        relativePath: source,
        executionId: headers["x-jsenv-execution-id"],
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
          eTag: createETag(compiledSource),
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
          "last-modified": new Date(cache.lastModifiedMs).toUTCString(),
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
