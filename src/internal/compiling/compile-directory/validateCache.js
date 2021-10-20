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
  // When "compileCacheAssetsValidation" is enabled, code ensures that
  // - asset file exists
  // - asset file content matches an etag generated when the file was compiled
  // In practice a compiled file asset is a sourcemap file or a coverage.json file.
  // It's unlikely that something or someone would update an asset file
  // and even when it happens it would be a bit strict to invalidate the cache
  // so by default "compileCacheAssetsValidation" is disabled
  // to avoid checking things for nothing
  compileCacheAssetsValidation = false,
}) => {
  const validity = { isValid: true }

  const metaJsonFileUrl = `${compiledFileUrl}__asset__meta.json`
  const metaValidity = await validateMetaFile(metaJsonFileUrl)
  mergeValidity(validity, "meta", metaValidity)
  if (!validity.isValid) {
    return validity
  }

  const compiledFileValidation = await validateCompiledFile({
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  mergeValidity(validity, "compiledFile", compiledFileValidation)
  if (!validity.isValid) {
    return validity
  }

  const meta = metaValidity.data
  const [sourcesValidity, assetsValidity] = await Promise.all([
    compileCacheSourcesValidation
      ? validateSources({
          meta,
          metaJsonFileUrl,
        })
      : { isValid: true, code: "SOURCES_VALIDATION_DISABLED" },
    compileCacheAssetsValidation
      ? validateAssets({
          meta,
          metaJsonFileUrl,
        })
      : { isValid: true, code: "ASSETS_VALIDATION_DISABLED" },
  ])
  mergeValidity(validity, "sources", sourcesValidity)
  mergeValidity(validity, "assets", assetsValidity)

  return validity
}

const mergeValidity = (parentValidity, childValidityName, childValidity) => {
  parentValidity.isValid = childValidity.isValid
  if (childValidity.code) parentValidity.code = childValidity.code
  parentValidity[childValidityName] = childValidity
}

const validateMetaFile = async (metaJsonFileUrl) => {
  const validity = { isValid: true, data: {} }

  let metaJsonBuffer
  try {
    metaJsonBuffer = readFileSync(fileURLToPath(metaJsonFileUrl))
  } catch (error) {
    if (error && error.code === "ENOENT") {
      validity.isValid = false
      validity.code = "META_FILE_NOT_FOUND"
      return validity
    }
    throw error
  }

  const metaJsonString = String(metaJsonBuffer)
  let meta
  try {
    meta = JSON.parse(metaJsonString)
  } catch (error) {
    if (error && error.name === "SyntaxError") {
      validity.isValid = false
      validity.code = "META_FILE_SYNTAX_ERROR"
      return validity
    }
    throw error
  }

  validity.data = meta
  if (meta.sources.length === 0) {
    validity.isValid = false
    validity.code = "SOURCES_EMPTY"
    return validity
  }

  return validity
}

const validateCompiledFile = async ({
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  const validity = { isValid: true, data: {} }

  try {
    const compiledSourceBuffer = readFileSync(fileURLToPath(compiledFileUrl))
    validity.data.compiledSourceBuffer = compiledSourceBuffer

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(compiledSourceBuffer)
      validity.data.compiledEtag = compiledEtag
      if (ifEtagMatch !== compiledEtag) {
        validity.isValid = false
        validity.code = "COMPILED_FILE_ETAG_MISMATCH"
        return validity
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await readFileSystemNodeModificationTime(
        compiledFileUrl,
      )
      validity.data.compiledMtime = compiledMtime
      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        validity.isValid = false
        validity.code = "COMPILED_FILE_MTIME_OUTDATED"
        return validity
      }
    }

    return validity
  } catch (error) {
    if (error && error.code === "ENOENT") {
      validity.isValid = false
      validity.code = "COMPILED_FILE_NOT_FOUND"
      return validity
    }
    throw error
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
  const validity = { isValid: true, data: {} }
  const sourceFileUrl = resolveUrl(source, metaJsonFileUrl)

  try {
    const sourceBuffer = readFileSync(fileURLToPath(sourceFileUrl))
    const sourceETag = bufferToEtag(sourceBuffer)
    validity.data.sourceBuffer = sourceBuffer
    validity.data.sourceETag = sourceETag

    if (sourceETag !== eTag) {
      validity.isValid = false
      validity.code = "SOURCE_ETAG_MISMATCH"
      return validity
    }

    return validity
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
      validity.isValid = false
      validity.code = "SOURCE_NOT_FOUND"
      return validity
    }
    throw e
  }
}

const validateAssets = async ({ metaJsonFileUrl, meta }) => {
  const assetsValidity = { isValid: true }
  await Promise.all(
    meta.assets.map(async (asset, index) => {
      const assetValidity = await validateAsset({
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
  const validity = { isValid: true, data: {} }
  const assetFileUrl = resolveUrl(asset, metaJsonFileUrl)

  try {
    const assetBuffer = readFileSync(fileURLToPath(assetFileUrl))
    const assetContentETag = bufferToEtag(assetBuffer)
    validity.data.buffer = assetBuffer
    validity.data.etag = assetContentETag

    if (eTag !== assetContentETag) {
      validity.isValid = false
      validity.code = "ASSET_ETAG_MISMATCH"
      return validity
    }

    return validity
  } catch (error) {
    if (error && error.code === "ENOENT") {
      validity.isValid = false
      validity.code = "ASSET_FILE_NOT_FOUND"
      return validity
    }
    throw error
  }
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}
