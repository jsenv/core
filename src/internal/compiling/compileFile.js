import {
  urlToRelativeUrl,
  fileSystemPathToUrl,
  resolveUrl,
  bufferToEtag,
} from "@jsenv/filesystem"
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"

import { getOrGenerateCompiledFile } from "./compile-directory/getOrGenerateCompiledFile.js"
import { updateMeta } from "./compile-directory/updateMeta.js"

export const compileFile = async ({
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

  const clientNeedsEtagHeader = cacheWithETag && !clientCacheDisabled
  const clientNeedsLastModifiedHeader = cacheWithMtime && !clientCacheDisabled

  try {
    const { meta, compileResult, compileResultStatus, timing } =
      await getOrGenerateCompiledFile({
        logger,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        fileContentFallback,
        clientNeedsEtagHeader,
        clientNeedsLastModifiedHeader,
        ifEtagMatch,
        ifModifiedSinceDate,
        useFilesystemAsCache,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        compile,
      })

    if (clientNeedsEtagHeader && !compileResult.compiledEtag) {
      // happens when file was just compiled so etag was not computed

      compileResult.compiledEtag = bufferToEtag(
        Buffer.from(compileResult.compiledSource),
      )
    }

    if (clientNeedsLastModifiedHeader && !compileResult.compiledMtime) {
      // happens when file was just compiled so it's not yet written on filesystem
      // Here we know the compiled file will be written on the filesystem
      // We could wait for the file to be written before responding to the client
      // but it could delay a bit the response.
      // Inside "updateMeta" the file might be written synchronously
      // or batched to be written later for perf reasons.
      // Fron this side of the code we would like to be agnostic about this to allow
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

    if (
      compileResultStatus === "created" ||
      compileResultStatus === "updated"
    ) {
      if (writeOnFilesystem) {
        updateMeta({
          logger,
          meta,
          compileResult,
          compileResultStatus,
          compiledFileUrl,
          // originalFileUrl,
        })
      }
    }

    compileResult.sources.forEach((source) => {
      const sourceFileUrl = resolveUrl(source, compiledFileUrl)
      projectFileRequestedCallback(
        urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl),
        request,
      )
    })

    const { contentType, compiledEtag, compiledMtime, compiledSource } =
      compileResult

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

    if (clientNeedsEtagHeader) {
      if (ifEtagMatch && compileResultStatus === "cached") {
        return {
          status: 304,
          timing,
        }
      }
      return respondUsingRAM((response) => {
        // eslint-disable-next-line dot-notation
        response.headers["etag"] = compiledEtag
      })
    }

    if (clientNeedsLastModifiedHeader) {
      if (ifModifiedSinceDate && compileResultStatus === "cached") {
        return {
          status: 304,
          timing,
        }
      }
      return respondUsingRAM((response) => {
        response.headers["last-modified"] = new Date(
          compiledMtime,
        ).toUTCString()
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
