import { fileMakeDirname } from "@dmail/helper"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveDirectoryUrl } from "../urlHelpers.js"
import { readCache } from "./readCache.js"
import { validateCache } from "./validateCache.js"
import { updateCache } from "./updateCache.js"
import { getCacheFilePath, getSourceFilePath, getCompiledFilePath } from "./locaters.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

const lockfile = import.meta.require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  projectDirectoryPath,
  cacheDirectoryRelativePath,
  sourceRelativePath,
  compileRelativePath = sourceRelativePath,
  compile,
  cacheIgnored = false,
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  ifEtagMatch,
  ifModifiedSinceDate,
  logLevel,
}) => {
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, got ${projectDirectoryPath}`)
  }
  if (typeof cacheDirectoryRelativePath !== "string") {
    throw new TypeError(
      `cacheDirectoryRelativePath must be a string, got ${cacheDirectoryRelativePath}`,
    )
  }
  if (typeof sourceRelativePath !== "string") {
    throw new TypeError(`sourceRelativePath must be a string, got ${sourceRelativePath}`)
  }
  if (typeof compileRelativePath !== "string") {
    throw new TypeError(`compileRelativePath must be a string, got ${compileRelativePath}`)
  }
  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`)
  }

  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  const cacheDirectoryUrl = resolveDirectoryUrl(cacheDirectoryUrl, projectDirectoryUrl)

  const logger = createLogger({ logLevel })

  return startAsap(
    async () => {
      const { cache, compileResult, compileResultStatus } = await computeCompileReport({
        projectDirectoryUrl,
        cacheDirectoryUrl,
        sourceRelativePath,
        compileRelativePath,
        compile,
        ifEtagMatch,
        ifModifiedSinceDate,
        cacheIgnored,
        logger,
      })

      // useless because missing source cannot invalidate cache
      // see validateSource in validateCache.js
      // some sources might not exists on the filesystem
      // keep them in the sourcemap
      // however do not mark them as dependency of the compiled version
      // const sources = []
      // const sourcesContent = []
      // await Promise.all(
      //   compileResult.sources.map(async (source, index) => {
      //     const path = pathnameToOperatingSystemPath(`${projectPathname}${source}`)
      //     const pathLeadsToFile = await new Promise((resolve) => {
      //       stat(path, (error, stats) => {
      //         if (error) {
      //           resolve(false)
      //         } else {
      //           resolve(stats.isFile())
      //         }
      //       })
      //     })
      //     if (pathLeadsToFile) {
      //       sources[index] = source
      //       sourcesContent[index] = compileResult.sourcesContent[index]
      //     }
      //   }),
      // )

      // const compileResultWithoutMissingSource = {
      //   ...compileResult,
      //   sources: sources.filter((source) => source !== undefined),
      //   sourcesContent: sourcesContent.filter((sourceContent) => sourceContent !== undefined),
      // }

      await updateCache({
        cacheDirectoryUrl,
        sourceRelativePath,
        compileRelativePath,
        cacheHitTracking,
        cache,
        compileResult,
        compileResultStatus,
        logger,
      })

      return { cache, compileResult, compileResultStatus }
    },
    {
      cacheDirectoryUrl,
      compileRelativePath,
      cacheInterProcessLocking,
      logger,
    },
  )
}

const computeCompileReport = async ({
  projectDirectoryUrl,
  cacheDirectoryUrl,
  sourceRelativePath,
  compileRelativePath,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cacheIgnored,
  logger,
}) => {
  const cache = cacheIgnored
    ? null
    : await readCache({
        cacheDirectoryUrl,
        sourceRelativePath,
        compileRelativePath,
        logger,
      })

  if (!cache) {
    const compileResult = await callCompile({
      projectDirectoryUrl,
      cacheDirectoryUrl,
      sourceRelativePath,
      compileRelativePath,
      compile,
      logger,
    })

    return {
      cache: null,
      compileResult,
      compileResultStatus: "created",
    }
  }

  const cacheValidation = await validateCache({
    projectDirectoryUrl,
    cacheDirectoryUrl,
    compileRelativePath,
    cache,
    ifEtagMatch,
    ifModifiedSinceDate,
    logger,
  })
  if (!cacheValidation.valid) {
    const compileResult = await callCompile({
      projectDirectoryUrl,
      cacheDirectoryUrl,
      sourceRelativePath,
      compileRelativePath,
      compile,
      logger,
    })
    return { cache, compileResult, compileResultStatus: "updated" }
  }

  const { contentType, sources, assets } = cache
  const { compiledSource, sourcesContent, assetsContent } = cacheValidation.data
  return {
    cache,
    compileResult: { contentType, compiledSource, sources, sourcesContent, assets, assetsContent },
    compileResultStatus: "cached",
  }
}

const callCompile = async ({
  projectDirectoryUrl,
  cacheDirectoryUrl,
  sourceRelativePath,
  compileRelativePath,
  compile,
  logger,
}) => {
  const sourceFilePath = getSourceFilePath({
    projectDirectoryUrl,
    sourceRelativePath,
  })
  const compiledFilePath = getCompiledFilePath({
    cacheDirectoryUrl,
    compileRelativePath,
  })
  logger.debug(`compile ${sourceRelativePath}`)

  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile({
    sourceRelativePath,
    compileRelativePath,
    sourceFilePath,
    compiledFilePath,
  })

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

const startAsap = async (
  fn,
  { logger, cacheDirectoryUrl, compileRelativePath, cacheInterProcessLocking },
) => {
  const cacheFilePath = getCacheFilePath({
    cacheDirectoryUrl,
    compileRelativePath,
  })

  logger.debug(`lock ${cacheFilePath}`)
  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(cacheFilePath)

  let unlockInterProcessLock = () => {}
  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await fileMakeDirname(cacheFilePath)
    // https://github.com/moxystudio/node-proper-lockfile#lockfile-options
    unlockInterProcessLock = await lockfile.lock(cacheFilePath, {
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
    unlockLocal()
    unlockInterProcessLock()
    logger.debug(`unlock ${cacheFilePath}`)
  }

  // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug

  // we use two lock because the local lock is very fast, it's a sort of perf improvement
}
