import { createLogger } from "@jsenv/logger"
import { fileUrlToPath } from "internal/urlUtils.js"
import { createFileDirectories } from "internal/filesystemUtils.js"
import { readMeta } from "./readMeta.js"
import { validateMeta } from "./validateMeta.js"
import { updateMeta } from "./updateMeta.js"
import {
  resolveMetaJsonFileUrl,
  resolveOriginalFileUrl,
  resolveCompiledFileUrl,
} from "./locaters.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

const lockfile = import.meta.require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  logLevel,
  projectDirectoryUrl,
  originalFileRelativePath,
  compiledFileRelativePath = originalFileRelativePath,
  cache = false, // do not forget to pass this to true
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  ifEtagMatch,
  ifModifiedSinceDate,
  compile,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof originalFileRelativePath !== "string") {
    throw new TypeError(
      `originalFileRelativePath must be a string, got ${originalFileRelativePath}`,
    )
  }
  if (typeof compiledFileRelativePath !== "string") {
    throw new TypeError(
      `compiledFileRelativePath must be a string, got ${compiledFileRelativePath}`,
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
        originalFileRelativePath,
        compiledFileRelativePath,
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
        projectDirectoryUrl,
        originalFileRelativePath,
        compiledFileRelativePath,
        cacheHitTracking,
      })

      return {
        meta,
        compileResult,
        compileResultStatus,
      }
    },
    {
      projectDirectoryUrl,
      compiledFileRelativePath,
      cacheInterProcessLocking,
      logger,
    },
  )
}

const computeCompileReport = async ({
  projectDirectoryUrl,
  originalFileRelativePath,
  compiledFileRelativePath,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cache,
  logger,
}) => {
  const meta = cache
    ? await readMeta({
        logger,
        projectDirectoryUrl,
        originalFileRelativePath,
        compiledFileRelativePath,
      })
    : null

  if (!meta) {
    const compileResult = await callCompile({
      logger,
      projectDirectoryUrl,
      originalFileRelativePath,
      compiledFileRelativePath,
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
    compiledFileRelativePath,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!metaValidation.valid) {
    const compileResult = await callCompile({
      logger,
      projectDirectoryUrl,
      originalFileRelativePath,
      compiledFileRelativePath,
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
  originalFileRelativePath,
  compiledFileRelativePath,
  compile,
  logger,
}) => {
  const originalFileUrl = resolveOriginalFileUrl({
    projectDirectoryUrl,
    originalFileRelativePath,
  })
  const compiledFileUrl = resolveCompiledFileUrl({
    projectDirectoryUrl,
    compiledFileRelativePath,
  })
  logger.debug(`compile ${originalFileRelativePath}`)

  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile({
    originalFileUrl,
    compiledFileUrl,
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
  { logger, projectDirectoryUrl, compiledFileRelativePath, cacheInterProcessLocking },
) => {
  const metaJsonFileUrl = resolveMetaJsonFileUrl({
    projectDirectoryUrl,
    compiledFileRelativePath,
  })
  const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl)

  logger.debug(`lock ${metaJsonFilePath}`)
  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaJsonFilePath)

  let unlockInterProcessLock = () => {}
  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await createFileDirectories(metaJsonFilePath)
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
