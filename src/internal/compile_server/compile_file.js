import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/internal/convertFileSystemErrorToResponseProperties.js"
import { bufferToEtag } from "@jsenv/filesystem"

import { injectHmr } from "@jsenv/core/src/internal/hmr/hmr_injection.js"

import { reuseOrCreateCompiledFile } from "./jsenv_directory/reuse_or_create_compiled_file.js"
import { updateCompileCache } from "./jsenv_directory/update_compile_cache.js"

export const compileFile = async ({
  logger,

  projectDirectoryUrl,
  jsenvDirectory,
  jsenvRemoteDirectory,
  ressourceGraph,
  originalFileUrl,
  compiledFileUrl,

  request,
  responseHeaders = {},

  compileProfile,

  compileCacheStrategy,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  compile,
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
  try {
    const { meta, compileResult, compileResultStatus, timing } =
      await reuseOrCreateCompiledFile({
        logger,
        projectDirectoryUrl,
        jsenvRemoteDirectory,
        request,
        originalFileUrl,
        compiledFileUrl,

        compileCacheStrategy,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        compile,
      })
    if (compileCacheStrategy === "etag" && !compileResult.etag) {
      // happens when file was just compiled so etag was not computed
      compileResult.etag = bufferToEtag(Buffer.from(compileResult.content))
    }
    if (compileCacheStrategy === "mtime" && !compileResult.mtime) {
      // happens when file was just compiled so it's not yet written on filesystem
      // Here we know the compiled file will be written on the filesystem
      // We could wait for the file to be written before responding to the client
      // but it could delay a bit the response.
      // Inside "updateMeta" the file might be written synchronously
      // or batched to be written later for perf reasons.
      // From this side of the code we would like to be agnostic about this to allow
      // eventual perf improvments in that field.
      // For this reason the "mtime" we send to the client is decided here
      // by "compileResult.mtime = Date.now()"
      // "updateMeta" will respect this and when it will write the compiled file it will
      // use "utimes" to ensure the file mtime is the one we sent to the client
      // This is important so that a request sending an mtime
      // can be compared with the compiled file mtime on the filesystem
      // In the end etag is preffered over mtime by default so this will rarely
      // be useful
      compileResult.mtime = Date.now()
    }
    let { contentType, content, etag, mtime } = compileResult
    if (compileResult.responseHeaders) {
      responseHeaders = {
        ...responseHeaders,
        ...compileResult.responseHeaders,
      }
    }
    if (compileResultStatus !== "cached" && compileCacheStrategy !== "none") {
      // we MUST await updateMeta otherwise we might get 404
      // when serving sourcemap files
      await updateCompileCache({
        logger,
        jsenvDirectory,
        meta,
        compileResult,
        compileResultStatus,
        compiledFileUrl,
        // originalFileUrl,
      })
    }
    const hmr = new URL(originalFileUrl).searchParams.get("hmr")
    if (hmr) {
      const body = await injectHmr({
        projectDirectoryUrl,
        ressourceGraph,
        url: originalFileUrl,
        contentType,
        moduleFormat: compileProfile.moduleOutFormat,
        content,
      })
      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(body),
          "content-type": contentType,
          "cache-control": "no-store", // not really needed thanks to the query param
          ...responseHeaders,
        },
        body,
        timing,
      }
    }
    // when a compiled version of the source file was just created or updated
    // we don't want to rely on filesystem because we might want to delay
    // when the file is written for perf reasons
    // Moreover we already got the data in RAM
    const respondUsingRAM = async (finalizeResponse = () => {}) => {
      const response = {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(content),
          "content-type": contentType,
          "cache-control": "no-store",
          ...responseHeaders,
        },
        body: content,
        timing,
      }
      finalizeResponse(response)
      return response
    }
    const clientCacheDisabled = request.headers["cache-control"] === "no-cache"
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
        response.headers["etag"] = etag
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
        response.headers["last-modified"] = new Date(mtime).toUTCString()
        response.headers["cache-control"] = "private,max-age=0,must-revalidate"
      })
    }
    return respondUsingRAM()
  } catch (error) {
    if (error && error.asResponse) {
      return error.asResponse()
    }
    if (error && error.statusText === "Unexpected directory operation") {
      return {
        status: 403,
      }
    }
    return convertFileSystemErrorToResponseProperties(error)
  }
}
