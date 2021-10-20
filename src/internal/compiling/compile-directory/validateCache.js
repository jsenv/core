import {
  resolveUrl,
  readFileSystemNodeModificationTime,
  bufferToEtag,
} from "@jsenv/filesystem"

import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

export const validateCache = async ({
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
  compileCacheSourcesValidation = true,
  compileCacheAssetsValidation = true,
}) => {
  const validity = { isValid: true }

  const metaJsonFileUrl = `${compiledFileUrl}__asset__meta.json`
  let metaJsonBuffer
  try {
    metaJsonBuffer = readFileSync(fileURLToPath(metaJsonFileUrl))
  } catch (error) {
    if (error && error.code === "ENOENT") {
      const metaValidity = {
        isValid: false,
        code: "META_FILE_NOT_FOUND",
        data: { metaJsonFileUrl },
      }
      mergeValidity(validity, "meta", metaValidity)
      return validity
    }
    throw error
  }
  const metaJsonString = String(metaJsonBuffer)
  let meta
  try {
    meta = JSON.parse(metaJsonString)
    const metaValidity = { isValid: true, data: { meta } }
    mergeValidity(validity, "meta", metaValidity)
  } catch (error) {
    if (error && error.name === "SyntaxError") {
      const metaValidity = {
        isValid: false,
        code: "META_FILE_SYNTAX_ERROR",
        data: { metaJsonString },
      }
      mergeValidity(validity, "meta", metaValidity)
      return validity
    }
    throw error
  }

  const compiledFileValidation = await validateCompiledFile({
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  mergeValidity(validity, "compiledFile", compiledFileValidation)
  if (!validity.isValid) {
    return compiledFileValidation
  }

  if (meta.sources.length === 0) {
    const sourcesValidity = { isValid: false, code: "SOURCES_EMPTY" }
    mergeValidity(validity, "sources", sourcesValidity)
    return validity
  }

  const [sourcesValidity, assetsValidity] = await Promise.all([
    compileCacheSourcesValidation
      ? validateSources({
          meta,
          metaJsonFileUrl,
        })
      : [],
    compileCacheAssetsValidation
      ? validateAssets({
          meta,
          metaJsonFileUrl,
        })
      : [],
  ])
  mergeValidity(validity, "sources", sourcesValidity)
  mergeValidity(validity, "assets", assetsValidity)

  return validity
}

const mergeValidity = (parentValidity, childValidityName, childValidity) => {
  parentValidity.isValid = childValidity.isValid
  parentValidity.code = childValidity.code
  parentValidity[childValidityName] = childValidity
}

const validateCompiledFile = async ({
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  try {
    const compiledSourceBuffer = readFileSync(fileURLToPath(compiledFileUrl))

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(compiledSourceBuffer)
      if (ifEtagMatch !== compiledEtag) {
        return {
          isValid: false,
          code: "COMPILED_FILE_ETAG_MISMATCH",
          data: { compiledEtag },
        }
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await readFileSystemNodeModificationTime(
        compiledFileUrl,
      )
      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        return {
          isValid: false,
          code: "COMPILED_FILE_MTIME_OUTDATED",
          data: { compiledMtime },
        }
      }
    }

    return {
      isValid: true,
      data: {},
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        isValid: false,
        code: "COMPILED_FILE_NOT_FOUND",
        data: {},
      }
    }
    return Promise.reject(error)
  }
}

const validateSources = async ({ meta, metaJsonFileUrl }) => {
  const sourcesValidity = { isValid: true }
  await Promise.all(
    meta.sources.map(async (source, index) => {
      const sourceValidity = await validateSource({
        metaJsonFileUrl,
        source,
        eTag: meta.sourcesEtag[index],
      })
      mergeValidity(sourcesValidity, source, sourceValidity)
    }),
  )
  return sourcesValidity
}

const validateSource = async ({ metaJsonFileUrl, source, eTag }) => {
  const sourceFileUrl = resolveUrl(source, metaJsonFileUrl)

  try {
    const sourceBuffer = readFileSync(fileURLToPath(sourceFileUrl))
    const sourceETag = bufferToEtag(sourceBuffer)

    if (sourceETag !== eTag) {
      return {
        isValid: false,
        code: "SOURCE_ETAG_MISMATCH",
        data: {},
      }
    }

    return {
      isValid: true,
      data: { sourceETag },
    }
  } catch (e) {
    if (e && e.code === "ENOENT") {
      // missing source invalidates the cache because
      // we cannot check its validity
      // HOWEVER inside writeMeta we will check if a source can be found
      // when it cannot we will not put it as a dependency
      // to invalidate the cache.
      // It is important because some files are constructed on other files
      // which are not truly on the filesystem
      // (IN theory the above happens only for convertCommonJsWithRollup because jsenv
      // always have a concrete file especially to avoid that kind of thing)
      return {
        isValid: false,
        code: "SOURCE_NOT_FOUND",
        data: {},
      }
    }
    throw e
  }
}

const validateAssets = async ({ metaJsonFileUrl, meta }) => {
  const assetsValidity = { isValid: true }
  await Promise.all(
    meta.assets.map(async (asset, index) => {
      const assetValidity = validateAsset({
        asset,
        metaJsonFileUrl,
        eTag: meta.assetsEtag[index],
      })
      mergeValidity(assetsValidity, asset, assetValidity)
    }),
  )
  return assetsValidity
}

const validateAsset = async ({ asset, metaJsonFileUrl, eTag }) => {
  const assetFileUrl = resolveUrl(asset, metaJsonFileUrl)

  try {
    const assetBuffer = readFileSync(fileURLToPath(assetFileUrl))
    const assetContentETag = bufferToEtag(assetBuffer)

    if (eTag !== assetContentETag) {
      return {
        isValid: false,
        code: "ASSET_ETAG_MISMATCH",
        data: { assetContentETag },
      }
    }

    return {
      valid: true,
      data: { assetContentETag },
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        isValid: false,
        code: "ASSET_FILE_NOT_FOUND",
        data: {},
      }
    }
    return Promise.reject(error)
  }
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}
