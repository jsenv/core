import { fileMakeDirname } from "@dmail/helper"
import { convertFileSystemErrorToResponseProperties } from "../../serve-file/index.js"
import { createETag } from "../../createETag.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { readCache } from "./readCache.js"
import { validateCache } from "./validateCache.js"
import { updateCache } from "./updateCache.js"
import { getCacheFilename, getSourceFilename, getCompiledFilename } from "./locaters.js"

const lockfile = import.meta.require("proper-lockfile")

export const serveCompiledFile = async ({
  projectFolder,
  sourceFilenameRelative,
  compiledFilenameRelative,
  headers,
  compile,
  clientCompileCacheStrategy = "etag",
  serverCompileCacheTrackHit = false,
  serverCompileCacheInterProcessLocking = false,
}) => {
  if (
    clientCompileCacheStrategy !== "etag" &&
    clientCompileCacheStrategy !== "mtime" &&
    clientCompileCacheStrategy !== "none"
  )
    throw new Error(
      `clientCompileCacheStrategy must be etag, mtime or none, got ${clientCompileCacheStrategy}`,
    )

  const start = async () => {
    const cacheWithETag = clientCompileCacheStrategy === "etag"

    let ifEtagMatch
    if (cacheWithETag) {
      if ("if-none-match" in headers) {
        ifEtagMatch = headers["if-none-match"]
      }
    }

    const cacheWithMtime = clientCompileCacheStrategy === "mtime"
    let ifModifiedSinceDate
    if (cacheWithMtime) {
      const ifModifiedSince = headers["if-modified-since"]
      try {
        ifModifiedSinceDate = new Date(ifModifiedSince)
      } catch (e) {
        return {
          status: 400,
          statusText: "if-modified-since header is not a valid date",
        }
      }
    }

    const cacheIgnored = clientCompileCacheStrategy === "none"

    try {
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
        serverCompileCacheTrackHit,
        cache,
        compileResult,
        compileResultStatus,
      })

      const { contentType, compiledSource } = compileResult

      if (cacheWithETag) {
        if (ifEtagMatch && compileResultStatus === "cached") {
          return {
            status: 304,
          }
        }
        return {
          status: 200,
          headers: {
            "content-length": Buffer.byteLength(compiledSource),
            "content-type": contentType,
            eTag: createETag(compiledSource),
          },
          body: compiledSource,
        }
      }

      if (cacheWithMtime) {
        if (ifModifiedSinceDate && compileResultStatus === "cached") {
          return {
            status: 304,
          }
        }
        return {
          status: 200,
          headers: {
            "content-length": Buffer.byteLength(compiledSource),
            "content-type": contentType,
            "last-modified": new Date(cache.lastModifiedMs).toUTCString(),
          },
          body: compiledSource,
        }
      }

      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "cache-control": "no-store",
        },
        body: compiledSource,
      }
    } catch (error) {
      if (error && error.code === "PARSE_ERROR") {
        const json = JSON.stringify(error.data)

        return {
          status: 500,
          statusText: "parse error",
          headers: {
            "cache-control": "no-store",
            "content-length": Buffer.byteLength(json),
            "content-type": "application/json",
          },
          body: json,
        }
      }

      if (error && error.statusText === "Unexpected directory operation") {
        return {
          status: 403,
        }
      }

      if (error && error.code === "CACHE_CORRUPTION_ERROR") {
        return {
          status: 500,
        }
      }

      return convertFileSystemErrorToResponseProperties(error)
    }
  }

  return startAsap(start, {
    projectFolder,
    compiledFilenameRelative,
    serverCompileCacheInterProcessLocking,
  })
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
  { projectFolder, compiledFilenameRelative, serverCompileCacheInterProcessLocking },
) => {
  const cacheFilename = getCacheFilename({
    projectFolder,
    compiledFilenameRelative,
  })

  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(cacheFilename)

  let unlockInterProcessLock = () => {}
  if (serverCompileCacheInterProcessLocking) {
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
