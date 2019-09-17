import { fileMakeDirname } from "@dmail/helper"
import { readCache } from "./readCache.js"
import { validateCache } from "./validateCache.js"
import { updateCache } from "./updateCache.js"
import { getCacheFilePath, getSourceFilePath, getCompiledFilePath } from "./locaters.js"
import { createLockRegistry } from "./createLockRegistry.js"

const { lockForRessource } = createLockRegistry()

const lockfile = import.meta.require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  compile,
  cacheIgnored,
  cacheHitTracking,
  cacheInterProcessLocking,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  if (typeof projectPathname !== "string") {
    throw new TypeError(`projectPathname must be a string, got ${projectPathname}`)
  }
  if (typeof compileCacheFolderRelativePath !== "string") {
    throw new TypeError(
      `compileCacheFolderRelativePath must be a string, got ${compileCacheFolderRelativePath}`,
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

  return startAsap(
    async () => {
      const { cache, compileResult, compileResultStatus } = await computeCompileReport({
        projectPathname,
        compileCacheFolderRelativePath,
        sourceRelativePath,
        compileRelativePath,
        compile,
        ifEtagMatch,
        ifModifiedSinceDate,
        cacheIgnored,
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
        projectPathname,
        sourceRelativePath,
        compileRelativePath,
        cacheHitTracking,
        cache,
        compileResult,
        compileResultStatus,
      })

      return { cache, compileResult, compileResultStatus }
    },
    {
      projectPathname,
      compileRelativePath,
      cacheInterProcessLocking,
    },
  )
}

const computeCompileReport = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cacheIgnored,
}) => {
  const cache = cacheIgnored
    ? null
    : await readCache({
        projectPathname,
        compileCacheFolderRelativePath,
        sourceRelativePath,
        compileRelativePath,
      })

  if (!cache) {
    const compileResult = await callCompile({
      projectPathname,
      compileCacheFolderRelativePath,
      sourceRelativePath,
      compileRelativePath,
      compile,
    })

    return {
      cache: null,
      compileResult,
      compileResultStatus: "created",
    }
  }

  const cacheValidation = await validateCache({
    projectPathname,
    compileRelativePath,
    cache,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!cacheValidation.valid) {
    const compileResult = await callCompile({
      projectPathname,
      sourceRelativePath,
      compileRelativePath,
      compile,
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
  projectPathname,
  compileCacheFolderRelativePath,
  sourceRelativePath,
  compileRelativePath,
  compile,
}) => {
  const sourceFilename = getSourceFilePath({
    projectPathname,
    sourceRelativePath,
  })
  const compiledFilename = getCompiledFilePath({
    projectPathname,
    compileCacheFolderRelativePath,
    compileRelativePath,
  })

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
    sourceFilename,
    compiledFilename,
  })

  if (typeof contentType !== "string")
    throw new TypeError(`compile must return a contentType string, got ${contentType}`)
  if (typeof compiledSource !== "string")
    throw new TypeError(`compile must return a compiledSource string, got ${compiledSource}`)

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
  { projectPathname, compileRelativePath, cacheInterProcessLocking },
) => {
  const cacheFilePath = getCacheFilePath({
    projectPathname,
    compileRelativePath,
  })

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
  }

  // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug

  // we use two lock because the local lock is very fast, it's a sort of perf improvement
}
