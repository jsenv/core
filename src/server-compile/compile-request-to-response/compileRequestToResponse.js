import { fileRead, fileStat } from "@dmail/helper"
import { convertFileSystemErrorToResponseProperties } from "../../requestToFileResponse/index.js"
import { dateToSecondsPrecision } from "../../dateHelper.js"
import { createETag } from "../../createETag.js"
import { compileFile } from "../compile-file/index.js"

export const compileRequestToResponse = async ({
  projectFolder,
  compileInto,
  compileId,
  headers,
  filenameRelative,
  filename,
  compile,
  clientCompileCacheStrategy = "etag",
  serverCompileCacheStrategy,
  serverCompileCacheTrackHit,
  serverCompileCacheInterProcessLocking,
}) => {
  if (
    clientCompileCacheStrategy !== "etag" &&
    clientCompileCacheStrategy !== "mtime" &&
    clientCompileCacheStrategy !== "none"
  )
    throw new Error(
      `clientCompileCacheStrategy must be etag, mtime or none, got ${clientCompileCacheStrategy}`,
    )

  const cacheWithMtime = clientCompileCacheStrategy === "mtime"
  const cacheWithETag = clientCompileCacheStrategy === "etag"
  const cachedDisabled = clientCompileCacheStrategy === "none"

  const generateResponse = async () => {
    try {
      const { compiledSource, contentType } = await compileFile({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative,
        filename,
        compile,
        serverCompileCacheStrategy,
        serverCompileCacheTrackHit,
        serverCompileCacheInterProcessLocking,
      })
      return {
        status: 200,
        headers: {
          ...(cachedDisabled ? { "cache-control": "no-store" } : {}),
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
        },
        body: compiledSource,
      }
    } catch (e) {
      if (e && e.code === "PARSE_ERROR") {
        const json = JSON.stringify(e.data)

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
      throw e
    }
  }

  try {
    if (cacheWithMtime) {
      const { mtime } = await fileStat(filename)

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
            headers: {},
          }
        }
      }

      const response = await generateResponse()
      response.headers["last-modified"] = mtime.toUTCString()
      return response
    }

    if (cacheWithETag) {
      const content = await fileRead(filename)
      const eTag = createETag(content)

      if ("if-none-match" in headers) {
        const ifNoneMatch = headers["if-none-match"]

        if (ifNoneMatch === eTag) {
          return {
            status: 304,
            headers: {},
          }
        }
      }

      const response = await generateResponse()
      response.headers.eTag = eTag
      return response
    }

    return generateResponse()
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
