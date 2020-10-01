import { readFile } from "fs"
import { urlToFileSystemPath } from "@jsenv/util"

export const fetchCssAssets = async (cssDependencies) => {
  const assetUrls = []
  Object.keys(cssDependencies).forEach((cssFileUrl) => {
    assetUrls.push(...cssDependencies[cssFileUrl].assetUrls)
  })

  const assetSources = {}

  await Promise.all(
    assetUrls.map(async (url) => {
      const assetSource = new Promise((resolve, reject) => {
        readFile(urlToFileSystemPath(url), (error, buffer) => {
          if (error) {
            reject(error)
          } else {
            resolve(buffer)
          }
        })
      })
      return assetSource
    }),
  )

  return assetSources
}
