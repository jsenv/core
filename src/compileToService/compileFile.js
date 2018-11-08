import { createETag, isFileNotFoundError } from "./helpers.js"
import { readFile } from "../fileHelper.js"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { getMetaLocation, getOutputLocation, getAssetLocation, getOutputName } from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { objectMapValue } from "../objectHelper.js"

const getSourceCacheValidation = async ({
  localRoot,
  compileInto,
  compileId,
  file,
  inputFile,
  meta,
}) => {
  const input = await readFile(inputFile)
  const inputETag = createETag(input)

  if (inputETag !== meta.eTag) {
    return { valid: false, reason: `eTag outdated`, data: { input, inputETag } }
  }

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
      reason: "eTag valid and cache found",
      data: { input, inputETag, content },
    }
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {
        valid: false,
        reason: `cache not found at ${outputLocation}`,
        data: { input, inputETag },
      }
    }
    return Promise.reject(error)
  }
}

const getAssetCacheValidation = async ({
  localRoot,
  compileInto,
  compileId,
  file,
  asset,
  eTag,
}) => {
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
        data: {
          content,
        },
      }
    }

    return {
      valid: true,
      reason: "eTag match and asset content found",
      data: {
        content,
        contentETag,
      },
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

const getCacheValidation = async ({ localRoot, compileInto, compileId, file, inputFile, meta }) => {
  const [sourceCacheValidation, ...assetsCacheValidation] = await Promise.all([
    getSourceCacheValidation({
      localRoot,
      compileInto,
      compileId,
      file,
      inputFile,
      meta,
    }),
    ...Object.keys(meta.assetEtagMap).map((asset) => {
      return getAssetCacheValidation({
        localRoot,
        compileInto,
        compileId,
        file,
        asset,
        eTag: meta.assetEtagMap[asset],
      })
    }),
  ])

  const { valid, reason, data } = sourceCacheValidation
  const assetDataMap = {}
  assetsCacheValidation.forEach((assetData, index) => {
    assetDataMap[Object.keys(meta.assetEtagMap)[index]] = assetData
  })

  let validComposed
  let reasonComposed
  const dataComposed = {
    ...data,
    assetDataMap,
  }

  if (valid) {
    const firstInvalidAssetCacheValidation = assetsCacheValidation.find(
      (assetCacheValidation) => assetCacheValidation.valid === false,
    )
    if (firstInvalidAssetCacheValidation) {
      validComposed = false
      reasonComposed = firstInvalidAssetCacheValidation.reason
    } else {
      validComposed = true
      reasonComposed = reason
    }
  } else {
    validComposed = false
    reasonComposed = reason
  }

  return {
    valid: validComposed,
    reason: reasonComposed,
    data: dataComposed,
  }
}

const createCacheCorruptionError = (message) => {
  const error = new Error(message)
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const getFileMeta = async ({ localRoot, compileInto, compileId, file }) => {
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
  inputFile,
  cacheTrackHit,
  status,
  meta,
  inputETag,
  output,
  assetMap,
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
      ...Object.keys(assetMap).map((asset) => {
        const assetLocation = getAssetLocation({
          localRoot,
          compileInto,
          compileId,
          file,
          asset,
        })

        return fileWriteFromString(assetLocation, assetMap[asset])
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (isNew) {
      meta = {
        file,
        inputFile,
        eTag: inputETag,
        assetEtagMap: objectMapValue(assetMap, (value) => createETag(value)),
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
        inputFile, // may change because of locate
        eTag: inputETag,
        assetEtagMap: objectMapValue(assetMap, (value) => createETag(value)),
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
        inputFile, // may change because of locate
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
  inputFile,
  cacheStrategy = "etag",
  cacheTrackHit = false,
}) => {
  const outputName = getOutputName({
    compileInto,
    compileId,
    file,
  })

  const generate = async ({ input }) => {
    const compileParam =
      compileParamMap && compileId in compileParamMap ? compileParamMap[compileId] : {}

    const compileResult = await compile({
      localRoot,
      inputName: file,
      inputSource: input,
      outputName,
      ...compileParam,
    })

    return compileResult
  }

  if (cacheStrategy === "none") {
    const input = await readFile(inputFile)
    const { outputSource, assetMap } = await generate({ input })

    return {
      outputName,
      output: outputSource,
      assetMap,
    }
  }

  const fromCacheOrCompile = async () => {
    const meta = await getFileMeta({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    if (!meta) {
      const input = await readFile(inputFile)
      const { outputSource, assetMap } = await generate({ input })

      return {
        status: "created",
        input,
        inputETag: createETag(input),
        output: outputSource,
        assetMap,
      }
    }

    const { valid, data } = await getCacheValidation({
      localRoot,
      compileInto,
      compileId,
      file,
      inputFile,
      meta,
    })

    if (valid) {
      const { input, inputETag, content, assetDataMap } = data
      const assetMap = objectMapValue(assetDataMap, ({ data }) => data.content)

      return {
        status: "cached",
        meta,
        input,
        inputETag,
        output: content,
        assetMap,
      }
    }

    const { input } = data
    const { outputSource, assetMap } = generate({ input })

    return {
      status: "updated",
      meta,
      input,
      inputETag: createETag(input),
      output: outputSource,
      assetMap,
    }
  }

  const metaLocation = getMetaLocation({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  return lockForRessource(metaLocation).chain(async () => {
    const { meta, status, input, inputETag, output, assetMap } = await fromCacheOrCompile()

    await updateMeta({
      localRoot,
      compileInto,
      compileId,
      file,
      inputFile,
      cacheTrackHit,
      status,
      meta,
      input,
      inputETag,
      output,
      assetMap,
    })

    return {
      output,
      outputName,
      assetMap,
    }
  })
}
