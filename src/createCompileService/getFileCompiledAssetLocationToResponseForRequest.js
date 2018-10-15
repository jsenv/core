import { URL } from "url"
import { createFileService } from "../createFileService/index.js"

export const getFileCompiledAssetLocationToResponseForRequest = (
  getFileCompiledAssetLocation,
  request,
) => {
  const { url } = request

  const filename = url.pathname.slice(1)
  const assetName = filename.slice(0, -4) // 'folder/file.js.map' -> 'folder.file.js'

  return getFileCompiledAssetLocation({
    file: filename,
    asset: assetName,
  }).then(
    (assetLocation) => {
      if (assetLocation === "") {
        return {
          status: 404,
        }
      }
      return createFileService()({
        ...request,
        url: new URL(`${assetLocation}${url.search}`),
      })
    },
    (error) => {
      if (error && error.reason === "Unexpected directory operation") {
        return {
          status: 403,
        }
      }
      return Promise.reject(error)
    },
  )
}
