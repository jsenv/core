import { urlToFileSystemPath, writeFileContent, fileExists } from "@jsenv/util"
import { resolveSourceFileUrl, resolveMetaJsonFileUrl, resolveAssetFileUrl } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const updateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  cacheHitTracking,
  compileResult,
  compileResultStatus,
}) => {
  const isNew = compileResultStatus === "created"
  const isUpdated = compileResultStatus === "updated"
  const isCached = compileResultStatus === "cached"
  const { compiledSource, contentType, assets, assetsContent } = compileResult
  let { sources, sourcesContent } = compileResult

  // ensure source that does not leads to concrete files are not capable to invalidate the cache
  const sourceExists = await Promise.all(
    sources.map(async (source) => {
      const sourceFileUrl = resolveSourceFileUrl({ source, compiledFileUrl })
      const exists = await fileExists(sourceFileUrl)
      if (!exists) {
        // this can lead to cache never invalidated by itself
        // it's a very important warning
        logger.warn(`a source file cannot be found ${sourceFileUrl}.
-> excluding it from meta.sources & meta.sourcesEtag`)
      }
      return exists
    }),
  )
  sources = sources.filter((source, index) => sourceExists[index])
  sourcesContent = sourcesContent.filter((sourceContent, index) => sourceExists[index])

  const promises = []
  if (isNew || isUpdated) {
    const { writeCompiledSourceFile = true, writeAssetsFile = true } = compileResult

    if (writeCompiledSourceFile) {
      const compiledFilePath = urlToFileSystemPath(compiledFileUrl)
      logger.debug(`write compiled file at ${compiledFilePath}`)
      promises.push(writeFileContent(compiledFilePath, compiledSource))
    }

    if (writeAssetsFile) {
      promises.push(
        ...assets.map((asset, index) => {
          const assetFileUrl = resolveAssetFileUrl({
            compiledFileUrl,
            asset,
          })
          const assetFilePath = urlToFileSystemPath(assetFileUrl)
          logger.debug(`write compiled file asset at ${assetFilePath}`)
          return writeFileContent(assetFilePath, assetsContent[index])
        }),
      )
    }
  }

  if (isNew || isUpdated || (isCached && cacheHitTracking)) {
    let latestMeta

    if (isNew) {
      latestMeta = {
        contentType,
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) =>
          bufferToEtag(Buffer.from(sourceContent)),
        ),
        assets,
        assetsEtag: assetsContent.map((assetContent) => bufferToEtag(Buffer.from(assetContent))),
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking
          ? {
              matchCount: 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else if (isUpdated) {
      latestMeta = {
        ...meta,
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) =>
          bufferToEtag(Buffer.from(sourceContent)),
        ),
        assets,
        assetsEtag: assetsContent.map((assetContent) => bufferToEtag(Buffer.from(assetContent))),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking
          ? {
              matchCount: meta.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else {
      latestMeta = {
        ...meta,
        ...(cacheHitTracking
          ? {
              matchCount: meta.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    }

    const metaJsonFileUrl = resolveMetaJsonFileUrl({
      compiledFileUrl,
    })
    const metaJsonFilePath = urlToFileSystemPath(metaJsonFileUrl)

    logger.debug(`write compiled file meta at ${metaJsonFilePath}`)
    promises.push(writeFileContent(metaJsonFilePath, JSON.stringify(latestMeta, null, "  ")))
  }

  return Promise.all(promises)
}
