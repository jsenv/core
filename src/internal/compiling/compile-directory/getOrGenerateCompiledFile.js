import { timeStart, timeFunction, fetchUrl } from "@jsenv/server"
import { urlToFileSystemPath, readFile, writeFile } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { validateCache } from "./validateCache.js"
import { getMetaJsonFileUrl } from "./compile-asset.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

export const getOrGenerateCompiledFile = async ({
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,
  jsenvRemoteDirectory,

  compileCacheStrategy,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  request,
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
      return validateCache({
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

    const fetchOriginalFile = async () => {
      // The original file might be behind an http url.
      // In that case jsenv try first to read file from filesystem
      // in ".jsenv/.http/" directory. If not found, the url
      // is fetched and file is written in that ".jsenv/.http/" directory.
      // After that the only way to re-fetch this ressource is
      // to delete the content of ".jsenv/.http/"
      try {
        const code = await readFile(originalFileUrl)
        return { code }
      } catch (e) {
        // when file is not found and the file is referenced with an http url
        if (
          e &&
          e.code === "ENOENT" &&
          jsenvRemoteDirectory.isFileUrlForRemoteUrl(originalFileUrl)
        ) {
          const remoteUrl =
            jsenvRemoteDirectory.remoteUrlFromFileUrl(originalFileUrl)
          const requestHeadersToForward = { ...request.headers }
          delete requestHeadersToForward.host
          const response = await fetchUrl(remoteUrl, {
            mode: "cors",
            headers: requestHeadersToForward,
          })
          const { status } = response
          if (status !== 200) {
            throw new Error(`not 200`)
          }
          const responseBodyAsArrayBuffer = await response.arrayBuffer()
          const responseBodyAsBuffer = Buffer.from(responseBodyAsArrayBuffer)
          await writeFile(originalFileUrl, responseBodyAsBuffer)
          const code = String(responseBodyAsBuffer)
          return { code }
        }
        throw e
      }
    }
    const { code } = await fetchOriginalFile()
    const [compileTiming, compileResult] = await timeFunction("compile", () =>
      callCompile({
        logger,
        originalFileUrl,
        code,
        compile,
      }),
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
  return {
    meta,
    compileResult: {
      compiledSource: String(
        cacheValidity.compiledFile.data.compiledSourceBuffer,
      ),
      compiledEtag: cacheValidity.compiledFile.data.compiledEtag,
      compiledMtime: cacheValidity.compiledFile.data.compiledMtime,
      contentType,
      sources,
      assets,
      dependencies,
    },
    compileResultStatus: "cached",
    timing: {
      ...readCacheTiming,
    },
  }
}

const callCompile = async ({ logger, code, originalFileUrl, compile }) => {
  logger.debug(`compile ${originalFileUrl}`)
  const compileReturnValue = await compile({ code })
  if (typeof compileReturnValue !== "object" || compileReturnValue === null) {
    throw new TypeError(
      `compile must return an object, got ${compileReturnValue}`,
    )
  }
  const {
    contentType,
    compiledSource,
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
  if (typeof compiledSource !== "string") {
    throw new TypeError(
      `compile must return a compiledSource string, got ${compiledSource}`,
    )
  }
  return {
    contentType,
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    dependencies,
    responseHeaders,
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
