import { urlToFileSystemPath, readFile, readFileSystemNodeModificationTime } from "@jsenv/util"
import { resolveAssetFileUrl, resolveSourceFileUrl } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const validateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  const compiledFileValidation = await validateCompiledFile({
    logger,
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate,
  })
  if (!compiledFileValidation.valid) return compiledFileValidation

  if (meta.sources.length === 0) {
    logger.warn(`meta.sources is empty, cache considered as invalid by precaution`)
    return {
      code: "SOURCES_EMPTY",
      valid: false,
    }
  }

  const [sourcesValidations, assetValidations] = await Promise.all([
    validateSources({
      logger,
      meta,
      compiledFileUrl,
    }),
    validateAssets({
      logger,
      meta,
      compiledFileUrl,
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
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
}) => {
  try {
    const compiledSource = await readFile(compiledFileUrl)

    if (ifEtagMatch) {
      const compiledEtag = bufferToEtag(Buffer.from(compiledSource))
      if (ifEtagMatch !== compiledEtag) {
        logger.debug(`etag changed for ${urlToFileSystemPath(compiledFileUrl)}`)
        return {
          code: "COMPILED_FILE_ETAG_MISMATCH",
          valid: false,
          data: { compiledSource, compiledEtag },
        }
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await readFileSystemNodeModificationTime(compiledFileUrl)
      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        logger.debug(`mtime changed for ${urlToFileSystemPath(compiledFileUrl)}`)
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
      logger.debug(`compiled file not found at ${urlToFileSystemPath(compiledFileUrl)}`)
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: { compiledFileUrl },
      }
    }
    return Promise.reject(error)
  }
}

const validateSources = ({ logger, meta, compiledFileUrl }) => {
  return Promise.all(
    meta.sources.map((source, index) =>
      validateSource({
        logger,
        compiledFileUrl,
        source,
        eTag: meta.sourcesEtag[index],
      }),
    ),
  )
}

const validateSource = async ({ logger, compiledFileUrl, source, eTag }) => {
  const sourceFileUrl = resolveSourceFileUrl({
    source,
    compiledFileUrl,
  })

  try {
    const sourceContent = await readFile(sourceFileUrl)
    const sourceETag = bufferToEtag(Buffer.from(sourceContent))

    if (sourceETag !== eTag) {
      logger.debug(`etag changed for ${urlToFileSystemPath(sourceFileUrl)}`)
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: {
          source,
          sourceFileUrl,
          sourceContent,
        },
      }
    }

    return {
      valid: true,
      data: { sourceContent },
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
      logger.warn(`source not found at ${sourceFileUrl}`)
      return {
        code: "SOURCE_NOT_FOUND",
        valid: false,
        data: {
          source,
          sourceFileUrl,
          sourceContent: "",
        },
      }
    }
    throw e
  }
}

const validateAssets = ({ logger, compiledFileUrl, meta }) =>
  Promise.all(
    meta.assets.map((asset, index) =>
      validateAsset({
        logger,
        asset,
        compiledFileUrl,
        eTag: meta.assetsEtag[index],
      }),
    ),
  )

const validateAsset = async ({ logger, asset, compiledFileUrl, eTag }) => {
  const assetFileUrl = resolveAssetFileUrl({
    compiledFileUrl,
    asset,
  })

  try {
    const assetContent = await readFile(assetFileUrl)
    const assetContentETag = bufferToEtag(Buffer.from(assetContent))

    if (eTag !== assetContentETag) {
      logger.debug(`etag changed for ${urlToFileSystemPath(assetFileUrl)}`)
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: { asset, assetFileUrl, assetContent, assetContentETag },
      }
    }

    return {
      valid: true,
      data: { assetContent, assetContentETag },
    }
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger.debug(`asset not found at ${urlToFileSystemPath(assetFileUrl)}`)
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: { asset, assetFileUrl },
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
