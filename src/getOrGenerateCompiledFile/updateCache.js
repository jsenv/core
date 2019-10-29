import { fileWrite } from "@dmail/helper"
import { getCacheFilePath, getAssetFilePath, getCompiledFilePath } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const updateCache = ({
  cacheDirectoryUrl,
  sourceRelativePath,
  compileRelativePath,
  cacheHitTracking,
  cache,
  compileResult,
  compileResultStatus,
  logger,
}) => {
  const isNew = compileResultStatus === "created"
  const isUpdated = compileResultStatus === "updated"
  const isCached = compileResultStatus === "cached"
  const {
    compiledSource,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent,
  } = compileResult
  const promises = []

  if (isNew || isUpdated) {
    const { writeCompiledSourceFile = true, writeAssetsFile = true } = compileResult
    const compiledFilePath = getCompiledFilePath({
      cacheDirectoryUrl,
      compileRelativePath,
    })

    if (writeCompiledSourceFile) {
      logger.info(`write file cache at ${compiledFilePath}`)
      promises.push(fileWrite(compiledFilePath, compiledSource))
    }

    if (writeAssetsFile) {
      promises.push(
        ...assets.map((asset, index) => {
          const assetFilePath = getAssetFilePath({
            cacheDirectoryUrl,
            compileRelativePath,
            asset,
          })

          logger.info(`write asset cache at ${assetFilePath}`)
          return fileWrite(assetFilePath, assetsContent[index])
        }),
      )
    }
  }

  if (isNew || isUpdated || (isCached && cacheHitTracking)) {
    if (isNew) {
      cache = {
        sourceRelativePath,
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
      cache = {
        ...cache,
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) =>
          bufferToEtag(Buffer.from(sourceContent)),
        ),
        assets,
        assetsEtag: assetsContent.map((assetContent) => bufferToEtag(Buffer.from(assetContent))),
        lastModifiedMs: Number(Date.now()),
        ...(cacheHitTracking
          ? {
              matchCount: cache.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else {
      cache = {
        ...cache,
        ...(cacheHitTracking
          ? {
              matchCount: cache.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    }

    const cacheFilePath = getCacheFilePath({
      cacheDirectoryUrl,
      compileRelativePath,
    })

    logger.info(`write cache at ${cacheFilePath}`)
    promises.push(fileWrite(cacheFilePath, JSON.stringify(cache, null, "  ")))
  }

  return Promise.all(promises)
}
