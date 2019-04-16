import { fileRead, fileMakeDirname } from "@dmail/helper"
import { lockForRessource } from "./ressourceRegistry.js"
import { readCache } from "./readCache.js"
import { validateCache } from "./validateCache.js"
import { updateCache } from "./updateCache.js"
import { getCacheFilename, getCompiledFilenameRelative } from "./locaters.js"

const lockfile = import.meta.require("proper-lockfile")

export const compileFile = async ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  filename,
  compile,
  serverCompileCacheStrategy = "etag",
  serverCompileCacheTrackHit = false,
  serverCompileCacheInterProcessLocking = true,
}) => {
  // we could support mtime, but it cannot be fully trusted
  // better not implement it
  if (serverCompileCacheStrategy !== "etag" && serverCompileCacheStrategy !== "none")
    throw new Error(
      `serverCompileCacheStrategy must be etag or none, got ${serverCompileCacheStrategy}`,
    )

  const compiledFilenameRelative = getCompiledFilenameRelative({
    compileInto,
    compileId,
    filenameRelative,
  })

  const generate = async ({ source }) => {
    const {
      sources = [],
      sourcesContent = [],
      assets = [],
      assetsContent = [],
      contentType,
      compiledSource,
    } = await compile({
      source,
      compiledFilenameRelative,
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
    }
  }

  if (serverCompileCacheStrategy === "none") {
    const source = await fileRead(filename)
    const generateResult = await generate({ source })
    return {
      cache: null,
      status: "created",
      ...generateResult,
    }
  }

  const fromCacheOrCompile = async () => {
    const [cache, source] = await Promise.all([
      readCache({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative,
      }),
      fileRead(filename),
    ])

    if (!cache) {
      const generateResult = await generate({ source })
      return {
        cache,
        status: "created",
        ...generateResult,
      }
    }

    const cacheValidation = await validateCache({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
      filename,
      source,
      cache,
    })
    if (!cacheValidation.valid) {
      const generateResult = await generate({ source })
      return {
        cache,
        status: "updated",
        ...generateResult,
      }
    }

    const { compiledSource, sourcesContent, assetsContent } = cacheValidation.data

    return {
      cache,
      status: "cached",
      compiledSource,
      sourcesContent,
      assetsContent,
    }
  }

  const cacheFilename = getCacheFilename({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
  })

  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(cacheFilename)
  // after that we use a lock filenameRelative to be sure we don't conflict with other process
  // trying to do the same (mapy happen when spawining multiple server for instance)
  // https://github.com/moxystudio/node-proper-lockfile/issues/69
  await fileMakeDirname(cacheFilename)
  // https://github.com/moxystudio/node-proper-lockfile#lockfile-options
  const unlockInterProcessLock = serverCompileCacheInterProcessLocking
    ? await lockfile.lock(cacheFilename, {
        realpath: false,
        retries: {
          retries: 20,
          minTimeout: 20,
          maxTimeout: 500,
        },
      })
    : () => {}
  // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug

  // we use two lock because the local lock is very fast, it's a sort of perf improvement

  try {
    const {
      cache,
      status,
      contentType,
      compiledSource,
      sources,
      sourcesContent,
      assets,
      assetsContent,
    } = await fromCacheOrCompile()

    await updateCache({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
      filename,
      serverCompileCacheTrackHit,
      cache,
      status,
      compiledSource,
      contentType,
      sources,
      sourcesContent,
      assets,
      assetsContent,
    })

    return {
      contentType,
      compiledSource,
      sources,
      sourcesContent,
      assets,
      assetsContent,
    }
  } finally {
    // we want to unlock in case of error too
    unlockLocal()
    unlockInterProcessLock()
  }
}
