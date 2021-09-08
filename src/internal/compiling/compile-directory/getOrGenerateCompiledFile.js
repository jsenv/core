import { urlToFileSystemPath } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"
import { timeStart, timeFunction } from "@jsenv/server"
import { readFileContent } from "./fs-optimized-for-cache.js"
import { readMeta } from "./readMeta.js"
import { validateMeta } from "./validateMeta.js"
import { updateMeta } from "./updateMeta.js"
import { getMetaJsonFileUrl } from "./compile-asset.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

export const getOrGenerateCompiledFile = async ({
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,
  writeOnFilesystem,
  useFilesystemAsCache,
  cacheHitTracking = false,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  fileContentFallback,
  ifEtagMatch,
  ifModifiedSinceDate,
  compile,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`)
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
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`)
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
      const { meta, compileResult, compileResultStatus, timing } = await computeCompileReport({
        originalFileUrl,
        compiledFileUrl,
        compile,
        fileContentFallback,
        ifEtagMatch,
        ifModifiedSinceDate,
        useFilesystemAsCache,
        compileCacheSourcesValidation,
        compileCacheAssetsValidation,
        logger,
      })

      let cacheWriteTiming = {}
      if (writeOnFilesystem) {
        const result = await timeFunction("cache write", () =>
          updateMeta({
            logger,
            meta,
            compileResult,
            compileResultStatus,
            compiledFileUrl,
            cacheHitTracking,
          }),
        )
        cacheWriteTiming = result[0]
      }

      return {
        meta,
        compileResult,
        compileResultStatus,
        timing: {
          ...lockTiming,
          ...timing,
          ...cacheWriteTiming,
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
  originalFileUrl,
  compiledFileUrl,
  compile,
  fileContentFallback,
  ifEtagMatch,
  ifModifiedSinceDate,
  useFilesystemAsCache,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  logger,
}) => {
  const [cacheReadTiming, meta] = await timeFunction("cache read", async () => {
    if (useFilesystemAsCache) {
      return readMeta({
        logger,
        compiledFileUrl,
      })
    }
    return null
  })

  if (!meta) {
    const [compileTiming, compileResult] = await timeFunction("compile", () =>
      callCompile({
        logger,
        originalFileUrl,
        fileContentFallback,
        compile,
      }),
    )

    return {
      meta: null,
      compileResult,
      compileResultStatus: "created",
      timing: {
        ...cacheReadTiming,
        ...compileTiming,
      },
    }
  }

  const metaValidation = await validateMeta({
    logger,
    meta,
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate,
    compileCacheSourcesValidation,
    compileCacheAssetsValidation,
  })

  if (!metaValidation.valid) {
    const [compileTiming, compileResult] = await timeFunction("compile", () =>
      callCompile({
        logger,
        originalFileUrl,
        fileContentFallback,
        compile,
      }),
    )
    return {
      meta,
      compileResult,
      compileResultStatus: "updated",
      timing: {
        ...cacheReadTiming,
        ...metaValidation.timing,
        ...compileTiming,
      },
    }
  }

  const { contentType, sources, assets } = meta
  const { compiledSource, sourcesContent, assetsContent } = metaValidation.data
  return {
    meta,
    compileResult: {
      contentType,
      compiledSource,
      sources,
      sourcesContent,
      assets,
      assetsContent,
    },
    compileResultStatus: "cached",
    timing: {
      ...cacheReadTiming,
      ...metaValidation.timing,
    },
  }
}

const callCompile = async ({ logger, originalFileUrl, fileContentFallback, compile }) => {
  logger.debug(`compile ${originalFileUrl}`)

  const compileArgs =
    compile.length === 0
      ? []
      : await getArgumentsForCompile({ originalFileUrl, fileContentFallback })

  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile(...compileArgs)

  if (typeof contentType !== "string") {
    throw new TypeError(`compile must return a contentType string, got ${contentType}`)
  }
  if (typeof compiledSource !== "string") {
    throw new TypeError(`compile must return a compiledSource string, got ${compiledSource}`)
  }

  return {
    contentType,
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    ...rest,
  }
}

const getArgumentsForCompile = async ({ originalFileUrl, fileContentFallback }) => {
  let fileContent
  if (fileContentFallback) {
    try {
      fileContent = await readFileContent(originalFileUrl)
    } catch (e) {
      if (e.code === "ENOENT") {
        fileContent = await fileContentFallback()
      } else {
        throw e
      }
    }
  } else {
    fileContent = await readFileContent(originalFileUrl)
  }
  return [fileContent]
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
