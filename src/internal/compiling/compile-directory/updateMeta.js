import { urlToRelativeUrl, urlToFileSystemPath, bufferToEtag } from "@jsenv/util"
import { writeFileContent, testFilePresence } from "./fs-optimized-for-cache.js"
import { getMetaJsonFileUrl } from "./compile-asset.js"

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

  const promises = []
  if (isNew || isUpdated) {
    // ensure source that does not leads to concrete files are not capable to invalidate the cache
    const sourceExists = await Promise.all(
      sources.map(async (sourceFileUrl) => {
        const sourceFileExists = await testFilePresence(sourceFileUrl)
        if (sourceFileExists) {
          return true
        }
        // this can lead to cache never invalidated by itself
        // it's a very important warning
        logger.warn(`a source file cannot be found -> excluded from meta.sources & meta.sourcesEtag.
--- source ---
${sourceFileUrl}`)
        return false
      }),
    )
    sources = sources.filter((source, index) => sourceExists[index])
    sourcesContent = sourcesContent.filter((sourceContent, index) => sourceExists[index])

    const { writeCompiledSourceFile = true, writeAssetsFile = true } = compileResult

    if (writeCompiledSourceFile) {
      logger.debug(`write compiled file at ${urlToFileSystemPath(compiledFileUrl)}`)
      promises.push(
        writeFileContent(compiledFileUrl, compiledSource, {
          fileLikelyNotFound: isNew,
        }),
      )
    }

    if (writeAssetsFile) {
      promises.push(
        ...assets.map((assetFileUrl, index) => {
          logger.debug(`write compiled file asset at ${urlToFileSystemPath(assetFileUrl)}`)
          return writeFileContent(assetFileUrl, assetsContent[index], {
            fileLikelyNotFound: isNew,
          })
        }),
      )
    }
  }

  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl)

  if (isNew || isUpdated || (isCached && cacheHitTracking)) {
    let latestMeta

    const sourceAndAssetProps = {
      sources: sources.map((source) => urlToRelativeUrl(source, metaJsonFileUrl)),
      sourcesEtag: sourcesContent.map((sourceContent) => bufferToEtag(Buffer.from(sourceContent))),
      assets: assets.map((asset) => urlToRelativeUrl(asset, metaJsonFileUrl)),
      assetsEtag: assetsContent.map((assetContent) => bufferToEtag(Buffer.from(assetContent))),
    }

    if (isNew) {
      latestMeta = {
        contentType,
        ...sourceAndAssetProps,
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
      }
    } else if (isUpdated) {
      latestMeta = {
        ...meta,
        ...sourceAndAssetProps,
        lastModifiedMs: Number(Date.now()),
      }
    } else {
      latestMeta = {
        ...meta,
      }
    }

    if (cacheHitTracking) {
      latestMeta = {
        ...latestMeta,
        matchCount: 1,
        lastMatchMs: Number(Date.now()),
      }
    }

    logger.debug(`write compiled file meta at ${urlToFileSystemPath(metaJsonFileUrl)}`)
    promises.push(
      writeFileContent(metaJsonFileUrl, JSON.stringify(latestMeta, null, "  "), {
        fileLikelyNotFound: isNew,
      }),
    )
  }

  return Promise.all(promises)
}
