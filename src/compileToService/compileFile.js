import path from "path"
import lockfile from "proper-lockfile"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { fileRead, fileMakeDirname } from "@dmail/helper"
import { createETag, isFileNotFoundError } from "./helpers.js"
import {
  getMetaFilename,
  getOutputFilename,
  getAssetFilename,
  getOutputFilenameRelative,
} from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"

export const compileFile = async ({
  compile,
  projectFolder,
  compileInto,
  compileId,
  compileDescription = {},
  filenameRelative,
  filename,
  cacheStrategy = "etag",
  cacheTrackHit = false,
}) => {
  const outputFilenameRelative = getOutputFilenameRelative({
    compileInto,
    compileId,
    filenameRelative,
  })

  const generate = async ({ input }) => {
    const compileParam =
      compileDescription && compileId in compileDescription ? compileDescription[compileId] : {}

    const {
      sources = [],
      sourcesContent = [],
      assets = [],
      assetsContent = [],
      output,
    } = await compile({
      projectFolder,
      filenameRelative,
      filename,
      input,
      outputFilenameRelative,
      ...compileParam,
    })

    return {
      sources,
      sourcesContent,
      assets,
      assetsContent,
      output,
    }
  }

  if (cacheStrategy === "none") {
    const input = await fileRead(filename)
    const compileResult = await generate({ input })
    return {
      ...compileResult,
      outputFilenameRelative,
    }
  }

  const fromCacheOrCompile = async () => {
    const [meta, input] = await Promise.all([
      readFileMeta({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative,
      }),
      fileRead(filename),
    ])
    const eTag = createETag(input)

    if (!meta) {
      const generateResult = await generate({ input })
      return {
        status: "created",
        ...generateResult,
      }
    }

    const cache = await readCache({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
      filename,
      eTag,
      meta,
    })
    if (cache) {
      return {
        status: "cached",
        meta,
        sources: meta.sources,
        assets: meta.assets,
        sourcesContent: cache.sourcesContent,
        assetsContent: cache.assetsContent,
      }
    }

    const generateResult = await generate({ input })
    return {
      status: "updated",
      meta,
      ...generateResult,
    }
  }

  const metaFilename = getMetaFilename({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
  })

  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaFilename)
  // after that we use a lock filenameRelative to be sure we don't conflict with other process
  // trying to do the same (mapy happen when spawining multiple server for instance)
  // https://github.com/moxystudio/node-proper-lockfile/issues/69
  await fileMakeDirname(metaFilename)
  const unlockGlobal = await lockfile.lock(metaFilename, { realpath: false })
  // we use two lock because the local lock is very fast, it's a sort of perf improvement

  try {
    const {
      status,
      meta,
      sources,
      sourcesContent,
      assets,
      assetsContent,
      output,
    } = await fromCacheOrCompile()

    await updateMeta({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
      filename,
      cacheTrackHit,
      status,
      meta,
      sources,
      sourcesContent,
      assets,
      assetsContent,
      output,
    })

    return {
      sources,
      sourcesContent,
      assets,
      assetsContent,
      output,
      outputFilenameRelative,
    }
  } finally {
    // we want to unlock in case of rejection too
    unlockLocal()
    unlockGlobal()
  }
}

const validateAsset = async ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  asset,
  eTag,
}) => {
  const assetFilename = getAssetFilename({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
    asset,
  })

  try {
    const content = await fileRead(assetFilename)
    const contentETag = createETag(content)

    if (eTag !== contentETag) {
      return {
        valid: false,
        reason: `eTag mismatch on ${asset} for filenameRelative ${filenameRelative}`,
        data: content,
      }
    }

    return {
      valid: true,
      reason: "eTag match and asset content found",
      data: content,
    }
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {
        valid: false,
        reason: `asset not found at ${assetFilename}`,
      }
    }
    return Promise.reject(error)
  }
}

const validateAssets = async ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  meta,
}) => {
  return Promise.all(
    meta.assets.map((asset, index) => {
      return validateAsset({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative,
        asset,
        eTag: meta.assetsEtag[index],
      })
    }),
  )
}

const validateSource = async ({ projectFolder, source, eTag }) => {
  const sourceAbsolute = path.resolve(projectFolder, source)
  const sourceContent = await fileRead(sourceAbsolute)
  const sourceETag = createETag(source)

  if (sourceETag !== eTag) {
    return {
      valid: false,
      reason: `eTag outdated`,
      data: sourceContent,
    }
  }

  return {
    valid: true,
    reason: "eTag valid",
    data: sourceContent,
  }
}

const validateSources = async ({ projectFolder, meta }) => {
  return await Promise.all(
    meta.sources.map((source, index) => {
      return validateSource({
        projectFolder,
        source,
        eTag: meta.sourcesEtag[index],
      })
    }),
  )
}

const validateCache = async ({ projectFolder, compileInto, compileId, filenameRelative }) => {
  const outputFilename = getOutputFilename({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
  })

  try {
    const content = await fileRead(outputFilename)
    return {
      valid: true,
      reason: "cache found",
      data: content,
    }
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {
        valid: false,
        reason: `cache not found at ${outputFilename}`,
      }
    }
    return Promise.reject(error)
  }
}

const readCache = async ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  eTag,
  meta,
}) => {
  const cacheValidation = await validateCache({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
  })

  if (!cacheValidation.valid) {
    return null
  }

  const cacheEtag = createETag(cacheValidation.data)
  if (cacheEtag !== eTag) {
    return null
  }

  const [sourcesValidations, assetValidations] = await Promise.all([
    validateSources({ projectFolder, meta }),
    validateAssets({ projectFolder, compileInto, compileId, filenameRelative, meta }),
  ])

  const invalidSource = sourcesValidations.find(({ valid }) => !valid)
  if (invalidSource) {
    return null
  }

  const invalidAsset = assetValidations.find(({ valid }) => !valid)
  if (invalidAsset) {
    return null
  }

  const sourcesContent = sourcesValidations.map(({ data }) => data)
  const assetsContent = assetValidations.find(({ data }) => data)

  return {
    sourcesContent,
    assetsContent,
  }
}

const createCacheCorruptionError = (message) => {
  const error = new Error(message)
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const readFileMeta = async ({ projectFolder, compileInto, compileId, filenameRelative }) => {
  const metaFilename = getMetaFilename({
    projectFolder,
    compileInto,
    compileId,
    filenameRelative,
  })

  try {
    const content = await fileRead(metaFilename)
    const meta = JSON.parse(content)
    if (meta.filenameRelative !== filenameRelative) {
      throw createCacheCorruptionError(
        `${metaFilename} corrupted: filenameRelative should be ${filenameRelative}, got ${
          meta.filenameRelative
        }`,
      )
    }
    return meta
  } catch (error) {
    if (isFileNotFoundError(error)) {
      // means meta filenameRelative not found
      return null
    }
    return Promise.reject(error)
  }
}

const updateMeta = ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  filename,
  cacheTrackHit,
  status,
  meta,
  sources,
  sourcesContent,
  assets,
  assetsContent,
  output,
}) => {
  const isNew = status === "created"
  const isUpdated = status === "updated"
  const isCached = status === "cached"

  const promises = []

  if (isNew || isUpdated) {
    const mainLocation = getOutputFilename({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
    })

    promises.push(
      fileWriteFromString(mainLocation, output),
      ...assets.map((asset, index) => {
        const assetFilename = getAssetFilename({
          projectFolder,
          compileInto,
          compileId,
          filenameRelative,
          asset,
        })

        return fileWriteFromString(assetFilename, assetsContent[index])
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (isNew) {
      meta = {
        filenameRelative,
        filename,
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) => createETag(sourceContent)),
        assets,
        assetsEtag: assetsContent.map((assetContent) => createETag(assetContent)),
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        ...(cacheTrackHit
          ? {
              matchCount: 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else if (isUpdated) {
      meta = {
        ...meta,
        filename, // may change because of locate
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) => createETag(sourceContent)),
        assets,
        assetsEtag: assetsContent.map((assetContent) => createETag(assetContent)),
        lastModifiedMs: Number(Date.now()),
        ...(cacheTrackHit
          ? {
              matchCount: meta.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else {
      meta = {
        ...meta,
        filename, // may change because of locate
        ...(cacheTrackHit
          ? {
              matchCount: meta.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    }

    const metaFilename = getMetaFilename({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
    })

    promises.push(fileWriteFromString(metaFilename, JSON.stringify(meta, null, "  ")))
  }

  return Promise.all(promises)
}
