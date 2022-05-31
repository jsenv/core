import { readFileSync, statSync } from "node:fs"
import { bufferToEtag } from "@jsenv/filesystem"

export const validateCompileCache = ({
  compiledFileUrl,
  compileCacheStrategy,
  compileCacheAssetsValidation = true,
}) => {
  const validity = { isValid: true }
  const compileInfoValidity = validateCompileInfoFile({
    compiledFileUrl,
  })
  validity.compileInfo = compileInfoValidity
  mergeValidity(validity, compileInfoValidity)
  if (!validity.isValid) {
    return validity
  }
  const compiledFileValidity = validateCompiledFile({
    compiledFileUrl,
    compileCacheStrategy,
  })
  validity.compiledFile = compiledFileValidity
  mergeValidity(validity, compiledFileValidity)
  if (!validity.isValid) {
    return validity
  }
  const compileInfo = compileInfoValidity.data
  const assetsValidity = compileCacheAssetsValidation
    ? validateAssets({
        compiledFileUrl,
        compileInfo,
      })
    : { isValid: true, code: "ASSETS_VALIDATION_DISABLED" }
  validity.assets = assetsValidity
  mergeValidity(validity, assetsValidity)
  if (!validity.isValid) {
    return validity
  }
  return validity
}

const validateCompileInfoFile = ({ compiledFileUrl }) => {
  const compileInfoFileUrl = `${compiledFileUrl}__compile_info__.json`
  const validity = { isValid: true, data: {} }
  let compileInfoFileContentAsBuffer
  try {
    compileInfoFileContentAsBuffer = readFileSync(new URL(compileInfoFileUrl))
  } catch (error) {
    if (error && error.code === "ENOENT") {
      validity.isValid = false
      validity.code = "COMPILE_INFO_FILE_NOT_FOUND"
      return validity
    }
    throw error
  }
  const compileInfoFileContentAsString = String(compileInfoFileContentAsBuffer)
  let compileInfo
  try {
    compileInfo = JSON.parse(compileInfoFileContentAsString)
  } catch (error) {
    if (error && error.name === "SyntaxError") {
      validity.isValid = false
      validity.code = "COMPILE_INFO_FILE_SYNTAX_ERROR"
      return validity
    }
    throw error
  }
  validity.data = compileInfo
  if (Object.keys(compileInfo.assetInfos).length === 0) {
    validity.isValid = false
    validity.code = "ASSETS_EMPTY"
    return validity
  }
  return validity
}

const validateCompiledFile = ({
  compiledFileUrl,
  compileCacheStrategy,
  lastEtag,
  lastModificationTime,
}) => {
  const validity = { isValid: true, data: {} }
  try {
    const buffer = readFileSync(new URL(compiledFileUrl))
    validity.data.buffer = buffer
    if (compileCacheStrategy === "etag" && lastEtag) {
      const etag = bufferToEtag(buffer)
      validity.data.etag = etag
      if (lastEtag && lastEtag !== etag) {
        validity.isValid = false
        validity.code = "COMPILED_FILE_ETAG_MISMATCH"
        return validity
      }
    }
    if (compileCacheStrategy === "mtime" && lastModificationTime) {
      const stats = statSync(new URL(compiledFileUrl))
      const mtime = Math.floor(stats.mtimeMs)
      validity.data.mtime = mtime
      let ifModifiedSinceDate
      try {
        ifModifiedSinceDate = new Date(lastModificationTime)
      } catch (e) {
        ifModifiedSinceDate = null
        // ideally we should rather respond with
        // 400 "if-modified-since header is not a valid date"
      }
      if (
        ifModifiedSinceDate &&
        ifModifiedSinceDate < dateToSecondsPrecision(mtime)
      ) {
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

const validateAssets = ({ compiledFileUrl, compileInfo }) => {
  const assetsValidity = { isValid: true, data: {} }

  const assetRelativeUrls = Object.keys(compileInfo.assetInfos)
  for (const assetRelativeUrl of assetRelativeUrls) {
    const assetInfo = compileInfo.assetInfos[assetRelativeUrl]
    const assetUrl = new URL(assetRelativeUrl, compiledFileUrl).href
    const assetValidity = { isValid: true, data: {} }
    if (assetInfo.type === "source") {
      validateSource(assetValidity, {
        sourceFileUrl: assetUrl,
        eTag: assetInfo.etag,
      })
    }
    if (assetInfo.type === "sourcemap") {
      validateSourcemap(assetValidity, {
        sourcemapFileUrl: assetUrl,
      })
    }
    assetsValidity.data[assetUrl] = assetValidity
    mergeValidity(assetsValidity, assetValidity)
    if (!assetsValidity.isValid) {
      break
    }
  }

  return assetsValidity
}

const validateSource = (validity, { sourceFileUrl, eTag }) => {
  try {
    const sourceBuffer = readFileSync(new URL(sourceFileUrl))
    const sourceETag = bufferToEtag(sourceBuffer)
    validity.data.content = String(sourceBuffer)
    validity.data.etag = sourceETag
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

const validateSourcemap = (validity, { sourcemapFileUrl }) => {
  let sourcemapFileContentAsBuffer
  try {
    sourcemapFileContentAsBuffer = readFileSync(new URL(sourcemapFileUrl))
  } catch (error) {
    if (error && error.code === "ENOENT") {
      validity.isValid = false
      validity.code = "SOURCEMAP_FILE_NOT_FOUND"
      return validity
    }
    throw error
  }
  const sourcemapFileContentAsString = String(sourcemapFileContentAsBuffer)
  validity.data.content = sourcemapFileContentAsString
  let sourcemap
  try {
    sourcemap = JSON.parse(sourcemapFileContentAsString)
  } catch (error) {
    if (error && error.name === "SyntaxError") {
      validity.isValid = false
      validity.code = "SOURCEMAP_FILE_SYNTAX_ERROR"
      return validity
    }
    throw error
  }
  validity.data.sourcemap = sourcemap
  return validity
}

const mergeValidity = (parentValidity, childValidity) => {
  parentValidity.isValid = childValidity.isValid
  if (childValidity.code) parentValidity.code = childValidity.code
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}
