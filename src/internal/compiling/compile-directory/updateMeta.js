import { fileUrlToPath } from "internal/urlUtils.js"
import { writeFileContent } from "internal/filesystemUtils.js"
import { resolveMetaJsonFileUrl, resolveAssetFileUrl, resolveCompiledFileUrl } from "./locaters.js"
import { bufferToEtag } from "./bufferToEtag.js"

export const updateMeta = ({
  logger,
  meta,
  projectDirectoryUrl,
  originalFileRelativePath,
  compiledFileRelativePath,
  cacheHitTracking,
  compileResult,
  compileResultStatus,
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

    if (writeCompiledSourceFile) {
      const compiledFileUrl = resolveCompiledFileUrl({
        projectDirectoryUrl,
        compiledFileRelativePath,
      })
      const compiledFilePath = fileUrlToPath(compiledFileUrl)
      logger.debug(`write compiled file at ${compiledFilePath}`)
      promises.push(writeFileContent(compiledFilePath, compiledSource))
    }

    if (writeAssetsFile) {
      promises.push(
        ...assets.map((asset, index) => {
          const assetFileUrl = resolveAssetFileUrl({
            projectDirectoryUrl,
            compiledFileRelativePath,
            asset,
          })
          const assetFilePath = fileUrlToPath(assetFileUrl)
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
        originalFileRelativePath,
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
      projectDirectoryUrl,
      compiledFileRelativePath,
    })
    const metaJsonFilePath = fileUrlToPath(metaJsonFileUrl)

    logger.debug(`write compiled file meta at ${metaJsonFilePath}`)
    promises.push(writeFileContent(metaJsonFilePath, JSON.stringify(latestMeta, null, "  ")))
  }

  return Promise.all(promises)
}
