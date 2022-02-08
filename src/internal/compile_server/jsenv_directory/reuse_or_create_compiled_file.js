import { timeStart, timeFunction } from "@jsenv/server"
import { urlToFileSystemPath } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { readNodeStream } from "@jsenv/core/src/internal/read_node_stream.js"

import { validateCompileCache } from "./validate_compile_cache.js"
import { getMetaJsonFileUrl } from "./compile_asset.js"
import { createLockRegistry } from "./file_lock_registry.js"

const { lockForRessource } = createLockRegistry()

export const reuseOrCreateCompiledFile = async ({
  logger,

  projectDirectoryUrl,
  jsenvRemoteDirectory,
  request,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,

  compileCacheStrategy,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  compile,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`,
    )
  }
  if (typeof originalFileUrl !== "string") {
    throw new TypeError(
      `originalFileUrl must be a string, got ${originalFileUrl}`,
    )
  }
  if (!originalFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(
      createDetailedMessage(`origin file must be inside project`, {
        ["original file url"]: originalFileUrl,
        ["project directory url"]: projectDirectoryUrl,
      }),
    )
  }
  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(
      `compiledFileUrl must be a string, got ${compiledFileUrl}`,
    )
  }
  if (!compiledFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(
      createDetailedMessage(`compiled file must be inside project`, {
        ["compiled file url"]: compiledFileUrl,
        ["project directory url"]: projectDirectoryUrl,
      }),
    )
  }
  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`)
  }

  const lockTimeEnd = timeStart("lock")
  return startAsap(
    async () => {
      const lockTiming = lockTimeEnd()
      const { meta, compileResult, compileResultStatus, timing } =
        await computeCompileReport({
          projectDirectoryUrl,
          originalFileUrl,
          compiledFileUrl,
          jsenvRemoteDirectory,

          compile,
          compileCacheStrategy,
          compileCacheSourcesValidation,
          compileCacheAssetsValidation,
          request,
          logger,
        })
      return {
        meta,
        compileResult,
        compileResultStatus,
        timing: {
          ...lockTiming,
          ...timing,
        },
      }
    },
    {
      compiledFileUrl,
      logger,
    },
  )
}

const computeCompileReport = async ({
  // projectDirectoryUrl,
  logger,
  originalFileUrl,
  compiledFileUrl,
  jsenvRemoteDirectory,

  compile,
  compileCacheStrategy,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  request,
}) => {
  const [readCacheTiming, cacheValidity] = await timeFunction(
    "read cache",
    () => {
      // if (!useFilesystemAsCache) {
      //   return {
      //     isValid: false,
      //     code: "META_FILE_NOT_FOUND",
      //     meta: {
      //       isValid: false,
      //       code: "META_FILE_NOT_FOUND",
      //     },
      //   }
      // }
      return validateCompileCache({
        logger,
        compiledFileUrl,
        compileCacheStrategy,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        request,
      })
    },
  )
  if (!cacheValidity.isValid) {
    if (cacheValidity.code === "SOURCES_EMPTY") {
      logger.warn(`WARNING: meta.sources is empty for ${compiledFileUrl}`)
    }
    const metaIsValid = cacheValidity.meta ? cacheValidity.meta.isValid : false
    const response = await jsenvRemoteDirectory.fetchUrl(originalFileUrl, {
      request,
    })
    if (response.status !== 200) {
      const error = { asResponse: () => response }
      throw error
    }
    const buffer = await readNodeStream(response.body)
    const [compileTiming, compileResult] = await timeFunction(
      "compile",
      async () => {
        logger.debug(`compile ${originalFileUrl}`)
        const compileReturnValue = await compile({
          content: String(buffer),
        })
        if (
          typeof compileReturnValue !== "object" ||
          compileReturnValue === null
        ) {
          throw new TypeError(
            `compile must return an object, got ${compileReturnValue}`,
          )
        }
        const {
          contentType = response.headers["content-type"],
          content,
          sources = [],
          sourcesContent = [],
          assets = [],
          assetsContent = [],
          dependencies = [],
          responseHeaders,
        } = compileReturnValue
        if (typeof contentType !== "string") {
          throw new TypeError(
            `compile must return a contentType string, got ${contentType}`,
          )
        }
        if (typeof content !== "string") {
          throw new TypeError(
            `compile must return a content string, got ${content}`,
          )
        }
        return {
          contentType,
          content,
          sources,
          sourcesContent,
          assets,
          assetsContent,
          dependencies,
          responseHeaders,
        }
      },
    )
    return {
      meta: metaIsValid ? cacheValidity.meta.data : null,
      compileResult,
      compileResultStatus: metaIsValid ? "updated" : "created",
      timing: {
        ...readCacheTiming,
        ...compileTiming,
      },
    }
  }
  const meta = cacheValidity.meta.data
  const { contentType, sources, assets, dependencies } = meta
  const compileResult = {
    contentType,
    content: String(cacheValidity.compiledFile.data.buffer),
    etag: cacheValidity.compiledFile.data.etag,
    mtime: cacheValidity.compiledFile.data.mtime,
    sources,
    assets,
    dependencies,
  }
  return {
    meta,
    compileResult,
    compileResultStatus: "cached",
    timing: {
      ...readCacheTiming,
    },
  }
}

const startAsap = async (fn, { logger, compiledFileUrl }) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl)
  const metaJsonFilePath = urlToFileSystemPath(metaJsonFileUrl)

  logger.debug(`lock ${metaJsonFilePath}`)
  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaJsonFilePath)

  let unlockInterProcessLock = () => {}

  try {
    return await fn()
  } finally {
    // we want to unlock in case of error too
    logger.debug(`unlock ${metaJsonFilePath}`)
    unlockLocal()
    unlockInterProcessLock()
  }
}
