import path from "path"
import lockfile from "proper-lockfile"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { readFile } from "../fileHelper.js"
import { createETag, isFileNotFoundError } from "./helpers.js"
import { getMetaLocation, getOutputLocation, getAssetLocation, getOutputFile } from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"

const validateAsset = async ({ localRoot, compileInto, compileId, file, asset, eTag }) => {
  const assetLocation = getAssetLocation({
    localRoot,
    compileInto,
    compileId,
    file,
    asset,
  })

  try {
    const content = await readFile(assetLocation)
    const contentETag = createETag(content)

    if (eTag !== contentETag) {
      return {
        valid: false,
        reason: `eTag mismatch on ${asset} for file ${file}`,
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
        reason: `asset not found at ${assetLocation}`,
      }
    }
    return Promise.reject(error)
  }
}

const validateAssets = async ({ localRoot, compileInto, compileId, file, meta }) => {
  return Promise.all(
    meta.assets.map((asset, index) => {
      return validateAsset({
        localRoot,
        compileInto,
        compileId,
        file,
        asset,
        eTag: meta.assetsEtag[index],
      })
    }),
  )
}

const validateSource = async ({ localRoot, source, eTag }) => {
  const sourceAbsolute = path.resolve(localRoot, source)
  const sourceContent = await readFile(sourceAbsolute)
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

const validateSources = async ({ localRoot, meta }) => {
  return await Promise.all(
    meta.sources.map((source, index) => {
      return validateSource({
        localRoot,
        source,
        eTag: meta.sourcesEtag[index],
      })
    }),
  )
}

const validateCache = async ({ localRoot, compileInto, compileId, file }) => {
  const outputLocation = getOutputLocation({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  try {
    const content = await readFile(outputLocation)
    return {
      valid: true,
      reason: "cache found",
      data: content,
    }
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {
        valid: false,
        reason: `cache not found at ${outputLocation}`,
      }
    }
    return Promise.reject(error)
  }
}

const readCache = async ({ localRoot, compileInto, compileId, file, eTag, meta }) => {
  const cacheValidation = await validateCache({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  if (!cacheValidation.valid) {
    return null
  }

  const cacheEtag = createETag(cacheValidation.data)
  if (cacheEtag !== eTag) {
    return null
  }

  const [sourcesValidations, assetValidations] = await Promise.all([
    validateSources({ localRoot, meta }),
    validateAssets({ localRoot, compileInto, compileId, file, meta }),
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

const readFileMeta = async ({ localRoot, compileInto, compileId, file }) => {
  const metaLocation = getMetaLocation({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  try {
    const content = await readFile(metaLocation)
    const meta = JSON.parse(content)
    if (meta.file !== file) {
      throw createCacheCorruptionError(
        `${metaLocation} corrupted: file should be ${file}, got ${meta.file}`,
      )
    }
    return meta
  } catch (error) {
    if (isFileNotFoundError(error)) {
      // means meta file not found
      return null
    }
    return Promise.reject(error)
  }
}

const updateMeta = ({
  localRoot,
  compileInto,
  compileId,
  file,
  fileAbsolute,
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
    const mainLocation = getOutputLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    promises.push(
      fileWriteFromString(mainLocation, output),
      ...assets.map((asset, index) => {
        const assetLocation = getAssetLocation({
          localRoot,
          compileInto,
          compileId,
          file,
          asset,
        })

        return fileWriteFromString(assetLocation, assetsContent[index])
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (isNew) {
      meta = {
        file,
        fileAbsolute,
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
        fileAbsolute, // may change because of locate
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
        fileAbsolute, // may change because of locate
        ...(cacheTrackHit
          ? {
              matchCount: meta.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    }

    const metaLocation = getMetaLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    promises.push(fileWriteFromString(metaLocation, JSON.stringify(meta, null, "  ")))
  }

  return Promise.all(promises)
}

export const compileFile = async ({
  compile,
  localRoot,
  compileInto,
  compileId,
  compileParamMap = {},
  file,
  fileAbsolute,
  cacheStrategy = "etag",
  cacheTrackHit = false,
}) => {
  const outputFile = getOutputFile({
    compileInto,
    compileId,
    file,
  })

  const generate = async ({ input }) => {
    const compileParam =
      compileParamMap && compileId in compileParamMap ? compileParamMap[compileId] : {}

    const {
      sources = [],
      sourcesContent = [],
      assets = [],
      assetsContent = [],
      output,
    } = await compile({
      localRoot,
      file,
      fileAbsolute,
      input,
      outputFile,
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
    const input = await readFile(fileAbsolute)
    const compileResult = generate({ input })
    return {
      ...compileResult,
      outputFile,
    }
  }

  const fromCacheOrCompile = async () => {
    const [meta, input] = await Promise.all([
      readFileMeta({
        localRoot,
        compileInto,
        compileId,
        file,
      }),
      readFile(fileAbsolute),
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
      localRoot,
      compileInto,
      compileId,
      file,
      fileAbsolute,
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

  const metaLocation = getMetaLocation({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  // in case this process try to concurrently access meta we wait for previous to be done
  const unlockLocal = await lockForRessource(metaLocation)
  // after that we use a lock file to be sure we don't conflict with other process
  // trying to do the same (mapy happen when spawining multiple server for instance)
  const unlockGlobal = await lockfile.lock(metaLocation)
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
      localRoot,
      compileInto,
      compileId,
      file,
      fileAbsolute,
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
      outputFile,
    }
  } finally {
    // we want to unlock in case of rejection too
    unlockLocal()
    unlockGlobal()
  }
}
