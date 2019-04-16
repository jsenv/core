import { fileWrite } from "@dmail/helper"
import { createETag } from "../../createETag.js"
import { getCacheFilename, getAssetFilename, getCompiledFilename } from "./locaters.js"

export const updateCache = ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  filename,
  serverCompileCacheTrackHit,
  cache,
  status,
  compiledSource,
  contentType,
  sources,
  sourcesContent,
  assets,
  assetsContent,
}) => {
  const isNew = status === "created"
  const isUpdated = status === "updated"
  const isCached = status === "cached"

  const promises = []

  if (isNew || isUpdated) {
    const compiledFilename = getCompiledFilename({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
    })

    promises.push(
      fileWrite(compiledFilename, compiledSource),
      ...assets.map((asset, index) => {
        const assetFilename = getAssetFilename({
          projectFolder,
          compileInto,
          compileId,
          filenameRelative,
          asset,
        })

        return fileWrite(assetFilename, assetsContent[index])
      }),
    )
  }

  if (isNew || isUpdated || (isCached && serverCompileCacheTrackHit)) {
    if (isNew) {
      cache = {
        filenameRelative,
        filename,
        contentType,
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) => createETag(sourceContent)),
        assets,
        assetsEtag: assetsContent.map((assetContent) => createETag(assetContent)),
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        ...(serverCompileCacheTrackHit
          ? {
              matchCount: 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else if (isUpdated) {
      cache = {
        ...cache,
        filename, // may change because of locate
        sources,
        sourcesEtag: sourcesContent.map((sourceContent) => createETag(sourceContent)),
        assets,
        assetsEtag: assetsContent.map((assetContent) => createETag(assetContent)),
        lastModifiedMs: Number(Date.now()),
        ...(serverCompileCacheTrackHit
          ? {
              matchCount: cache.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    } else {
      cache = {
        ...cache,
        filename, // may change because of locate
        ...(serverCompileCacheTrackHit
          ? {
              matchCount: cache.matchCount + 1,
              lastMatchMs: Number(Date.now()),
            }
          : {}),
      }
    }

    const cacheFilename = getCacheFilename({
      projectFolder,
      compileInto,
      compileId,
      filenameRelative,
    })

    promises.push(fileWrite(cacheFilename, JSON.stringify(cache, null, "  ")))
  }

  return Promise.all(promises)
}
