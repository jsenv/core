import { readFileSync, statSync } from "node:fs"
import { bufferToEtag } from "@jsenv/filesystem"

export const validateCompileCache = async ({
  compiledFileUrl,
  compileCacheStrategy,
  compileCacheSourcesValidation = true,
}) => {
  const validity = { isValid: true }
  const compileInfoValidity = validateCompileInfoFile({
    compiledFileUrl,
  })
  mergeValidity(validity, "compileInfo", compileInfoValidity)
  if (!validity.isValid) {
    return validity
  }
  const compiledFileValidation = validateCompiledFile({
    compiledFileUrl,
    compileCacheStrategy,
  })
  mergeValidity(validity, "compiledFile", compiledFileValidation)
  if (!validity.isValid) {
    return validity
  }
  const compileInfo = compileInfoValidity.data
  const sourcesValidity = compileCacheSourcesValidation
    ? validateSources({
        compiledFileUrl,
        compileInfo,
      })
    : { isValid: true, code: "SOURCES_VALIDATION_DISABLED" }
  mergeValidity(validity, "sources", sourcesValidity)
  if (!validity.valid) {
    return validity
  }
  return validity
}

const validateCompileInfoFile = ({ compiledFileUrl }) => {
  const compileInfoFileUrl = `${compiledFileUrl}__compile_info.json`
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
  if (compileInfo.sources.length === 0) {
    validity.isValid = false
    validity.code = "SOURCES_EMPTY"
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

const validateSources = ({ compiledFileUrl, compileInfo }) => {
  const sourcesValidity = { isValid: true }
  const assetRelativeUrls = Object.keys(compileInfo.assetInfos)
  for (const assetRelativeUrl of assetRelativeUrls) {
    const assetInfo = compileInfo.assetInfos[assetRelativeUrl]
    if (assetInfo.type !== "source") {
      continue
    }
    const sourceValidity = validateSource({
      compiledFileUrl,
      sourceRelativeUrl: assetRelativeUrl,
      eTag: assetInfo.etag,
    })
    mergeValidity(sourcesValidity, assetRelativeUrl, sourceValidity)
    if (!sourcesValidity.valid) {
      break
    }
  }

  return sourcesValidity
}

const validateSource = ({ compiledFileUrl, sourceRelativeUrl, eTag }) => {
  const validity = { isValid: true, data: {} }
  const sourceFileUrlObject = new URL(sourceRelativeUrl, compiledFileUrl)
  try {
    const sourceBuffer = readFileSync(sourceFileUrlObject)
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

const mergeValidity = (parentValidity, childValidityName, childValidity) => {
  parentValidity.isValid = childValidity.isValid
  if (childValidity.code) parentValidity.code = childValidity.code
  parentValidity[childValidityName] = childValidity
}

const dateToSecondsPrecision = (date) => {
  const dateWithSecondsPrecision = new Date(date)
  dateWithSecondsPrecision.setMilliseconds(0)
  return dateWithSecondsPrecision
}
