import { fileMakeDirname } from "@dmail/helper"
import { createLogger } from "@jsenv/logger"
import { readMeta } from "./readMeta.js"
import { validateMeta } from "./validateMeta.js"
import { updateMeta } from "./updateMeta.js"
import {
  getPathForMetaJsonFile,
  getPathForOriginalFile,
  getPathForCompiledFile,
} from "./locaters.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

const lockfile = import.meta.require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  relativePathToProjectDirectory,
  relativePathToCompileDirectory = relativePathToProjectDirectory,
  compile,
  cache = false, // do not forget to pass this to true
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  ifEtagMatch,
  ifModifiedSinceDate,
  logLevel,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileDirectoryUrl !== "string") {
    throw new TypeError(`compileDirectoryUrl must be a string, got ${compileDirectoryUrl}`)
  }
  if (typeof relativePathToProjectDirectory !== "string") {
    throw new TypeError(
      `relativePathToProjectDirectory must be a string, got ${relativePathToProjectDirectory}`,
    )
  }
  if (typeof relativePathToCompileDirectory !== "string") {
    throw new TypeError(
      `relativePathToCompileDirectory must be a string, got ${relativePathToCompileDirectory}`,
    )
  }
  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`)
  }

  const logger = createLogger({ logLevel })

  return startAsap(
    async () => {
      const { meta, compileResult, compileResultStatus } = await computeCompileReport({
        projectDirectoryUrl,
        compileDirectoryUrl,
        relativePathToProjectDirectory,
        relativePathToCompileDirectory,
        compile,
        ifEtagMatch,
        ifModifiedSinceDate,
        cache,
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

      await updateMeta({
        logger,
        meta,
        compileResult,
        compileResultStatus,
        compileDirectoryUrl,
        relativePathToProjectDirectory,
        relativePathToCompileDirectory,
        cacheHitTracking,
      })

      return {
        meta,
        compileResult,
        compileResultStatus,
      }
    },
    {
      compileDirectoryUrl,
      relativePathToCompileDirectory,
      cacheInterProcessLocking,
      logger,
    },
  )
}

const computeCompileReport = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  relativePathToProjectDirectory,
  relativePathToCompileDirectory,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cache,
  logger,
}) => {
  const meta = cache
    ? await readMeta({
        logger,
        compileDirectoryUrl,
        relativePathToProjectDirectory,
        relativePathToCompileDirectory,
      })
    : null

  if (!meta) {
    const compileResult = await callCompile({
      logger,
      projectDirectoryUrl,
      compileDirectoryUrl,
      relativePathToProjectDirectory,
      relativePathToCompileDirectory,
      compile,
    })

    return {
      meta: null,
      compileResult,
      compileResultStatus: "created",
    }
  }

  const metaValidation = await validateMeta({
    logger,
    meta,
    projectDirectoryUrl,
    compileDirectoryUrl,
    relativePathToCompileDirectory,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!metaValidation.valid) {
    const compileResult = await callCompile({
      logger,
      projectDirectoryUrl,
      compileDirectoryUrl,
      relativePathToProjectDirectory,
      relativePathToCompileDirectory,
      compile,
    })
    return {
      meta,
      compileResult,
      compileResultStatus: "updated",
    }
  }

  const { contentType, sources, assets } = meta
  const { compiledSource, sourcesContent, assetsContent } = metaValidation.data
  return {
    meta,
    compileResult: { contentType, compiledSource, sources, sourcesContent, assets, assetsContent },
    compileResultStatus: "cached",
  }
}

const callCompile = async ({
  projectDirectoryUrl,
  compileDirectoryUrl,
  relativePathToProjectDirectory,
  relativePathToCompileDirectory,
  compile,
  logger,
}) => {
  const originalFilePath = getPathForOriginalFile({
    projectDirectoryUrl,
    relativePathToProjectDirectory,
  })
  const compiledFilePath = getPathForCompiledFile({
    compileDirectoryUrl,
    relativePathToCompileDirectory,
  })
  logger.debug(`compile ${relativePathToProjectDirectory}`)

  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile({
    originalFilePath,
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
  { logger, compileDirectoryUrl, relativePathToCompileDirectory, cacheInterProcessLocking },
) => {
  const metaJsonFilePath = getPathForMetaJsonFile({
    compileDirectoryUrl,
    relativePathToCompileDirectory,
  })

  logger.debug(`lock ${metaJsonFilePath}`)
  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaJsonFilePath)

  let unlockInterProcessLock = () => {}
  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await fileMakeDirname(metaJsonFilePath)
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
    unlockLocal()
    unlockInterProcessLock()
    logger.debug(`unlock ${metaJsonFilePath}`)
  }

  // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug

  // we use two lock because the local lock is very fast, it's a sort of perf improvement
}
