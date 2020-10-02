import { urlToRelativeUrl } from "@jsenv/util"
import { computeFileUrlForCaching } from "./computeFileUrlForCaching.js"

export const createAssetHandler = (projectDirectoryUrl) => {
  const assetReferencesByUrl = {}
  const emitAsset = (rollup, { assetFileUrl, assetFileUrlForRollup, assetFileContent }) => {
    if (assetFileUrl in assetReferencesByUrl) {
      return assetReferencesByUrl[assetFileUrl].assetReferenceId
    }
    if (assetFileUrlForRollup === undefined) {
      assetFileUrlForRollup = computeFileUrlForCaching(assetFileUrl, assetFileContent)
    }
    const assetFileName = urlToRelativeUrl(assetFileUrlForRollup, projectDirectoryUrl)
    const assetReferenceId = rollup.emitFile({
      type: "asset",
      fileName: assetFileName,
      source: assetFileContent,
    })
    assetReferencesByUrl[assetFileUrl] = {
      assetReferenceId,
      assetFileName,
    }
    return assetReferenceId
  }

  const getAssetReferenceId = (assetFileUrl) => {
    return assetFileUrl in assetReferencesByUrl
      ? assetReferencesByUrl[assetFileUrl].assetReferenceId
      : null
  }

  const getAssetFileName = (assetFileUrl) => {
    return assetFileUrl in assetReferencesByUrl
      ? assetReferencesByUrl[assetFileUrl].assetFileName
      : null
  }

  return {
    emitAsset,
    getAssetReferenceId,
    getAssetFileName,
  }
}
