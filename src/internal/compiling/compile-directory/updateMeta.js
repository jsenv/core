import {
  urlToRelativeUrl,
  urlToFileSystemPath,
  bufferToEtag,
} from "@jsenv/filesystem"
import { utimesSync } from "node:fs"

import { writeFileContent, testFilePresence } from "./fs-optimized-for-cache.js"
import { getMetaJsonFileUrl } from "./compile-asset.js"

export const updateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  compileResult,
  compileResultStatus,
}) => {
  const isNew = compileResultStatus === "created"
  const isUpdated = compileResultStatus === "updated"
  const {
    compiledSource,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    dependencies,
  } = compileResult

  const promises = []
  if (isNew || isUpdated) {
    // ensure source that does not leads to concrete files are not capable to invalidate the cache
    const sourcesToRemove = []
    sources.forEach((sourceFileUrl) => {
      const sourceFileExists = testFilePresence(sourceFileUrl)
      if (sourceFileExists) {
        return
      }

      sourcesToRemove.push(sourceFileUrl)
    })
    const sourceNotFoundCount = sourcesToRemove.length
    if (sourceNotFoundCount > 0) {
      logger.warn(`SOURCE_META_NOT_FOUND: ${sourceNotFoundCount} source file(s) not found.
--- consequence ---
cache will be reused even if one of the source file is modified
--- source files not found ---
${sourcesToRemove.join(`\n`)}`)
      sourcesToRemove.forEach((url) => {
        const sourceIndex = sources.indexOf(url)
        if (sourceIndex) {
          sources.splice(sourceIndex, 1)
          sourcesContent.splice(sourceIndex, 1)
        }
      })
    }

    const { writeCompiledSourceFile = true, writeAssetsFile = true } =
      compileResult

    if (writeCompiledSourceFile) {
      logger.debug(
        `write compiled file at ${urlToFileSystemPath(compiledFileUrl)}`,
      )
      promises.push(
        writeFileContent(compiledFileUrl, compiledSource, {
          fileLikelyNotFound: isNew,
        }).then(() => {
          const mtime = compileResult.compiledMtime
          // when compileResult.compiledMtime do not exists it means
          // the client is not interested in it so
          // -> moment we write the file is not important
          // -> There is no need to update mtime
          if (mtime) {
            utimesSync(
              urlToFileSystemPath(compiledFileUrl),
              new Date(mtime),
              new Date(mtime),
            )
          }
        }),
      )
    }

    if (writeAssetsFile) {
      promises.push(
        ...assets.map((assetFileUrl, index) => {
          logger.debug(
            `write compiled file asset at ${urlToFileSystemPath(assetFileUrl)}`,
          )
          return writeFileContent(assetFileUrl, assetsContent[index], {
            fileLikelyNotFound: isNew,
          })
        }),
      )
    }
  }

  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl)

  if (isNew || isUpdated) {
    let latestMeta

    const sourceAndAssetProps = {
      sources: sources.map((source) =>
        urlToRelativeUrl(source, metaJsonFileUrl),
      ),
      sourcesEtag: sourcesContent.map((sourceContent) =>
        bufferToEtag(Buffer.from(sourceContent)),
      ),
      assets: assets.map((asset) => urlToRelativeUrl(asset, metaJsonFileUrl)),
      assetsEtag: assetsContent.map((assetContent) =>
        bufferToEtag(Buffer.from(assetContent)),
      ),
      dependencies,
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

    logger.debug(
      `write compiled file meta at ${urlToFileSystemPath(metaJsonFileUrl)}`,
    )
    promises.push(
      writeFileContent(
        metaJsonFileUrl,
        JSON.stringify(latestMeta, null, "  "),
        {
          fileLikelyNotFound: isNew,
        },
      ),
    )
  }

  return Promise.all(promises)
}
