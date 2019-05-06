import { fileMakeDirname } from "@dmail/helper"
import { lockForRessource } from "./ressourceRegistry.js"
import { readCache } from "./readCache.js"
import { validateCache } from "./validateCache.js"
import { updateCache } from "./updateCache.js"
import { getCacheFilename, getSourceFilename, getCompiledFilename } from "./locaters.js"

const lockfile = import.meta.require("proper-lockfile")

export const getOrGenerateCompiledFile = async ({
  projectFolder,
  sourceFilenameRelative,
  compiledFilenameRelative,
  compile,
  cacheIgnored,
  cacheHitTracking,
  cacheInterProcessLocking,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  return startAsap(
    async () => {
      const { cache, compileResult, compileResultStatus } = await computeCompileReport({
        projectFolder,
        sourceFilenameRelative,
        compiledFilenameRelative,
        compile,
        ifEtagMatch,
        ifModifiedSinceDate,
        cacheIgnored,
      })

      await updateCache({
        projectFolder,
        sourceFilenameRelative,
        compiledFilenameRelative,
        cacheHitTracking,
        cache,
        compileResult,
        compileResultStatus,
      })

      return { cache, compileResult, compileResultStatus }
    },
    {
      projectFolder,
      compiledFilenameRelative,
      cacheInterProcessLocking,
    },
  )
}

const computeCompileReport = async ({
  projectFolder,
  sourceFilenameRelative,
  compiledFilenameRelative,
  compile,
  ifEtagMatch,
  ifModifiedSinceDate,
  cacheIgnored,
}) => {
  const cache = cacheIgnored
    ? null
    : await readCache({
        projectFolder,
        sourceFilenameRelative,
        compiledFilenameRelative,
      })

  if (!cache) {
    const compileResult = await callCompile({
      projectFolder,
      sourceFilenameRelative,
      compiledFilenameRelative,
      compile,
    })

    return {
      cache: null,
      compileResult,
      compileResultStatus: "created",
    }
  }

  const cacheValidation = await validateCache({
    projectFolder,
    compiledFilenameRelative,
    cache,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!cacheValidation.valid) {
    const compileResult = await callCompile({
      projectFolder,
      sourceFilenameRelative,
      compiledFilenameRelative,
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
  projectFolder,
  sourceFilenameRelative,
  compiledFilenameRelative,
  compile,
}) => {
  const sourceFilename = getSourceFilename({
    projectFolder,
    sourceFilenameRelative,
  })
  const compiledFilename = getCompiledFilename({
    projectFolder,
    compiledFilenameRelative,
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
    sourceFilenameRelative,
    compiledFilenameRelative,
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
  { projectFolder, compiledFilenameRelative, cacheInterProcessLocking },
) => {
  const cacheFilename = getCacheFilename({
    projectFolder,
    compiledFilenameRelative,
  })

  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(cacheFilename)

  let unlockInterProcessLock = () => {}
  if (cacheInterProcessLocking) {
    // after that we use a lock filenameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await fileMakeDirname(cacheFilename)
    // https://github.com/moxystudio/node-proper-lockfile#lockfile-options
    unlockInterProcessLock = await lockfile.lock(cacheFilename, {
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
