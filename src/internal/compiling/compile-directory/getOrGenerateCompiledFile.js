import { urlToFileSystemPath, ensureParentDirectories } from "@jsenv/util"
import { timeStart, timeFunction } from "@jsenv/server"
import { require } from "../../require.js"
import { readFileContent } from "./fs-optimized-for-cache.js"
import { readMeta } from "./readMeta.js"
import { validateMeta } from "./validateMeta.js"
import { updateMeta } from "./updateMeta.js"
import { getMetaJsonFileUrl } from "./compile-asset.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

const lockfile = require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  logger,

  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,
  writeOnFilesystem,
  useFilesystemAsCache,
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
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
    throw new Error(`origin file must be inside project
--- original file url ---
${originalFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
  }
  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`)
  }
  if (!compiledFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`compiled file must be inside project
--- compiled file url ---
${compiledFileUrl}
--- project directory url ---
${projectDirectoryUrl}`)
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
      cacheInterProcessLocking,
      logger,
    },
  )
}

const computeCompileReport = async ({
  originalFileUrl,
  compiledFileUrl,
  compile,
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

const callCompile = async ({ logger, originalFileUrl, compile }) => {
  logger.debug(`compile ${originalFileUrl}`)

  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile(compile.length ? await readFileContent(originalFileUrl) : undefined)

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

const startAsap = async (fn, { logger, compiledFileUrl, cacheInterProcessLocking }) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl)
  const metaJsonFilePath = urlToFileSystemPath(metaJsonFileUrl)

  logger.debug(`lock ${metaJsonFilePath}`)
  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaJsonFilePath)

  let unlockInterProcessLock = () => {}
  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await ensureParentDirectories(metaJsonFilePath)
    // https://github.com/moxystudio/node-proper-lockfile#lockfile-options
    unlockInterProcessLock = await lockfile.lock(metaJsonFilePath, {
      realpath: false,
      retries: {
        retries: 20,
        minTimeout: 20,
        maxTimeout: 500,
      },
    })
  }

  try {
    return await fn()
  } finally {
    // we want to unlock in case of error too
    logger.debug(`unlock ${metaJsonFilePath}`)
    unlockLocal()
    unlockInterProcessLock()
  }

  // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug

  // we use two lock because the local lock is very fast, it's a sort of perf improvement
}
