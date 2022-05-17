import { readFileSync } from "node:fs"
import { createLogger } from "@jsenv/logger"
import { assertAndNormalizeFileUrl } from "@jsenv/filesystem"

import { validateCompileCache } from "./validate_compile_cache.js"
import { createLockRegistry } from "./file_lock_registry.js"
import { updateCompileCache } from "./update_compile_cache.js"

const { lockForRessource } = createLockRegistry()

export const reuseOrCreateCompiledFile = async ({
  logLevel,
  sourceFileUrl,
  compiledFileUrl,
  compileCacheStrategy,
  compileCacheAssetsValidation,
  compile,
}) => {
  sourceFileUrl = assertAndNormalizeFileUrl(sourceFileUrl)

  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`)
  }
  const logger = createLogger({ logLevel })

  return startAsap(
    async () => {
      const cacheValidity = await validateCompileCache({
        logger,
        compiledFileUrl,
        compileCacheStrategy,
        compileCacheAssetsValidation,
      })
      if (cacheValidity.isValid) {
        const compileInfo = cacheValidity.compileInfo.data
        const content = String(cacheValidity.compiledFile.data.buffer)
        const assets = {}
        let sourcemap = null
        Object.keys(compileInfo.assetInfos).forEach((assetRelativeUrl) => {
          const assetUrl = new URL(assetRelativeUrl, compiledFileUrl).href
          const assetValidity = cacheValidity.assets.data[assetUrl]
          const asset = {
            type: compileInfo.assetInfos[assetRelativeUrl].type,
            etag: compileInfo.assetInfos[assetRelativeUrl].etag,
            content: assetValidity.data.content,
          }
          assets[assetUrl] = asset
          if (asset.type === "sourcemap") {
            sourcemap = assetValidity.data.sourcemap
          }
        })
        updateCompileCache({
          logger,
          compiledFileUrl,
          content,
          assets,
          compileResultStatus: "cached",
        })
        return {
          content,
          sourcemap,
        }
      }
      if (cacheValidity.code === "SOURCES_EMPTY") {
        logger.warn(`WARNING: meta.sources is empty for ${compiledFileUrl}`)
      }
      const compileInfoIsValid = cacheValidity.compileInfo
        ? cacheValidity.compileInfo.isValid
        : false
      const fileContentAsBuffer = readFileSync(new URL(sourceFileUrl))
      const fileContentAsString = String(fileContentAsBuffer)
      logger.debug(`compile ${sourceFileUrl}`)
      const compileResult = await compile({
        content: fileContentAsString,
      })
      if (typeof compileResult !== "object" || compileResult === null) {
        throw new TypeError(
          `compile must return an object, got ${compileResult}`,
        )
      }
      const { content, sourcemap, assets } = compileResult
      updateCompileCache({
        logger,
        compiledFileUrl,
        content,
        assets,
        compileResultStatus: compileInfoIsValid ? "updated" : "created",
      })
      return {
        content,
        sourcemap,
      }
    },
    {
      compiledFileUrl,
    },
  )
}

const startAsap = async (fn, { compiledFileUrl }) => {
  const unlockLocal = await lockForRessource(compiledFileUrl)
  try {
    return await fn()
  } finally {
    // "finally" we want to unlock in case of error too
    unlockLocal()
  }
}
