import { fileUrlToPath } from "internal/urlUtils.js"
import { readFileContent, readFileStat } from "internal/filesystemUtils.js"
import { resolveAssetFileUrl, resolveCompiledFileUrl, resolveSourceFileUrl } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const validateMeta = async ({
  logger,
  meta,
  projectDirectoryUrl,
  compiledFileRelativePath,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  const compiledFileValidation = await validateCompiledFile({
    logger,
    projectDirectoryUrl,
    compiledFileRelativePath,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!compiledFileValidation.valid) return compiledFileValidation

  const [sourcesValidations, assetValidations] = await Promise.all([
    validateSources({
      logger,
      meta,
      projectDirectoryUrl,
    }),
    validateAssets({
      logger,
      meta,
      projectDirectoryUrl,
      compiledFileRelativePath,
    }),
  ])

  const invalidSourceValidation = sourcesValidations.find(({ valid }) => !valid)
  if (invalidSourceValidation) return invalidSourceValidation

  const invalidAssetValidation = assetValidations.find(({ valid }) => !valid)
  if (invalidAssetValidation) return invalidAssetValidation

  const compiledSource = compiledFileValidation.data.compiledSource
  const sourcesContent = sourcesValidations.map(({ data }) => data.sourceContent)
  const assetsContent = assetValidations.find(({ data }) => data.assetContent)

  return {
    valid: true,
    data: {
      compiledSource,
      sourcesContent,
      assetsContent,
    },
  }
}

const validateCompiledFile = async ({
  logger,
  projectDirectoryUrl,
  compiledFileRelativePath,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  const compiledFileUrl = resolveCompiledFileUrl({
    projectDirectoryUrl,
    compiledFileRelativePath,
  })
  const compiledFilePath = fileUrlToPath(compiledFileUrl)

  try {
    const compiledSource = await readFileContent(compiledFilePath)

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(Buffer.from(compiledSource))
      if (ifEtagMatch !== compiledEtag) {
        logger.debug(`etag changed for ${compiledFilePath}`)
        return {
          code: "COMPILED_FILE_ETAG_MISMATCH",
          valid: false,
          data: { compiledSource, compiledEtag },
        }
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await readFileStat(compiledFilePath)
      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        logger.debug(`mtime changed for ${compiledFilePath}`)
        return {
          code: "COMPILED_FILE_MTIME_OUTDATED",
          valid: false,
          data: { compiledSource, compiledMtime },
        }
      }
    }

    return {
      valid: true,
      data: { compiledSource },
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: { compiledFilePath },
      }
    }
    return Promise.reject(error)
  }
}

const validateSources = ({ logger, meta, projectDirectoryUrl }) =>
  Promise.all(
    meta.sources.map((source, index) =>
      validateSource({
        logger,
        projectDirectoryUrl,
        source,
        eTag: meta.sourcesEtag[index],
      }),
    ),
  )

const validateSource = async ({ logger, projectDirectoryUrl, source, eTag }) => {
  const sourceFileUrl = resolveSourceFileUrl({
    source,
    projectDirectoryUrl,
  })
  const sourceFilePath = fileUrlToPath(sourceFileUrl)

  try {
    const sourceContent = await readFileContent(sourceFilePath)
    const sourceETag = bufferToEtag(Buffer.from(sourceContent))

    if (sourceETag !== eTag) {
      logger.debug(`etag changed for ${sourceFilePath}`)
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: { source, sourceFilePath, sourceContent },
      }
    }

    return {
      valid: true,
      data: { sourceContent },
    }
  } catch (e) {
    if (e && e.code === "ENOENT") {
      // TODO: decide if it should invalidate cache or not
      // I think if the source cannot be found it does not invalidate the cache
      // it means something is missing to absolutely sure the cache is valid
      // but does not necessarily means the cache is invalid
      // but if we allow source file not found
      // it means we must remove sources from the list of sources
      // or at least consider as normal that it's missing
      // in that case, inside updateCache we must not search for sources that
      // are missing, nor put their etag
      // or we could return sourceContent: '', and the etag would be empty
      logger.debug(`source not found at ${sourceFilePath}`)
      return {
        code: "SOURCE_NOT_FOUND",
        valid: true,
        data: { source, sourceFilePath, sourceContent: "" },
      }
    }
    throw e
  }
}

const validateAssets = ({ logger, projectDirectoryUrl, compiledFileRelativePath, meta }) =>
  Promise.all(
    meta.assets.map((asset, index) =>
      validateAsset({
        logger,
        asset,
        projectDirectoryUrl,
        compiledFileRelativePath,
        eTag: meta.assetsEtag[index],
      }),
    ),
  )

const validateAsset = async ({
  logger,
  asset,
  projectDirectoryUrl,
  compiledFileRelativePath,
  eTag,
}) => {
  const assetFileUrl = resolveAssetFileUrl({
    projectDirectoryUrl,
    compiledFileRelativePath,
    asset,
  })
  const assetFilePath = fileUrlToPath(assetFileUrl)

  try {
    const assetContent = await readFileContent(assetFilePath)
    const assetContentETag = bufferToEtag(Buffer.from(assetContent))

    if (eTag !== assetContentETag) {
      logger.debug(`etag changed for ${assetFilePath}`)
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: { asset, assetFilePath, assetContent, assetContentETag },
      }
    }

    return {
      valid: true,
      data: { assetContent, assetContentETag },
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(`asset not found at ${assetFilePath}`)
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: { asset, assetFilePath },
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
