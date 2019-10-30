import { fileRead, fileStat } from "@dmail/helper"
import { fileUrlToPath, resolveFileUrl } from "../urlHelpers.js"
import { dateToSecondsPrecision } from "./dateToSecondsPrecision.js"
import { getCompiledFilePath, getAssetFilePath } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const validateCache = async ({
  cacheDirectoryUrl,
  compileRelativePath,
  cache,
  ifEtagMatch,
  ifModifiedSinceDate,
  logger,
}) => {
  const compiledFileValidation = await validateCompiledFile({
    cacheDirectoryUrl,
    compileRelativePath,
    ifEtagMatch,
    ifModifiedSinceDate,
    logger,
  })
  if (!compiledFileValidation.valid) return compiledFileValidation

  const [sourcesValidations, assetValidations] = await Promise.all([
    validateSources({
      logger,
      cacheDirectoryUrl,
      cache,
    }),
    validateAssets({
      logger,
      cacheDirectoryUrl,
      compileRelativePath,
      cache,
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
  cacheDirectoryUrl,
  compileRelativePath,
  ifEtagMatch,
  ifModifiedSinceDate,
  logger,
}) => {
  const compiledFilePath = getCompiledFilePath({
    cacheDirectoryUrl,
    compileRelativePath,
  })

  try {
    const compiledSource = await fileRead(compiledFilePath)

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(Buffer.from(compiledSource))
      if (ifEtagMatch !== compiledEtag) {
        logger.info(`etag changed for ${compiledFilePath}`)
        return {
          code: "COMPILED_FILE_ETAG_MISMATCH",
          valid: false,
          data: { compiledSource, compiledEtag },
        }
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await fileStat(compiledFilePath)
      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        logger.info(`mtime changed for ${compiledFilePath}`)
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

const validateSources = ({ logger, cacheDirectoryUrl, cache }) =>
  Promise.all(
    cache.sources.map((source, index) =>
      validateSource({
        logger,
        cacheDirectoryUrl,
        source,
        eTag: cache.sourcesEtag[index],
      }),
    ),
  )

const validateSource = async ({ logger, cacheDirectoryUrl, source, eTag }) => {
  const sourceFileUrl = resolveFileUrl(source, cacheDirectoryUrl)
  const sourceFilePath = fileUrlToPath(sourceFileUrl)

  try {
    const sourceContent = await fileRead(sourceFilePath)
    const sourceETag = bufferToEtag(Buffer.from(sourceContent))

    if (sourceETag !== eTag) {
      logger.info(`etag changed for ${sourceFilePath}`)
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
      logger.info(`source not found at ${sourceFilePath}`)
      return {
        code: "SOURCE_NOT_FOUND",
        valid: true,
        data: { source, sourceFilePath, sourceContent: "" },
      }
    }
    throw e
  }
}

const validateAssets = ({ logger, cacheDirectoryUrl, compileRelativePath, cache }) =>
  Promise.all(
    cache.assets.map((asset, index) =>
      validateAsset({
        logger,
        cacheDirectoryUrl,
        compileRelativePath,
        asset,
        eTag: cache.assetsEtag[index],
      }),
    ),
  )

const validateAsset = async ({ logger, cacheDirectoryUrl, compileRelativePath, asset, eTag }) => {
  const assetFilePath = getAssetFilePath({
    cacheDirectoryUrl,
    compileRelativePath,
    asset,
  })

  try {
    const assetContent = await fileRead(assetFilePath)
    const assetContentETag = bufferToEtag(Buffer.from(assetContent))

    if (eTag !== assetContentETag) {
      logger.info(`etag changed for ${assetFilePath}`)
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
      logger.info(`asset not found at ${assetFilePath}`)
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: { asset, assetFilePath },
      }
    }
    return Promise.reject(error)
  }
}
