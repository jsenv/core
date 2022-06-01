import { statSync } from "node:fs"

import { urlToFilename } from "./url_utils.js"

export const applyFileSystemMagicResolution = (
  fileUrl,
  { magicDirectoryIndex, magicExtensions },
) => {
  let lastENOENTError = null
  const fileStatOrNull = (url) => {
    try {
      return statSync(new URL(url))
    } catch (e) {
      if (e.code === "ENOENT") {
        lastENOENTError = e
        return null
      }
      throw e
    }
  }

  const fileStat = fileStatOrNull(fileUrl)
  if (fileStat && fileStat.isFile()) {
    return {
      found: true,
      url: fileUrl,
    }
  }
  if (fileStat && fileStat.isDirectory()) {
    if (magicDirectoryIndex) {
      const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index"
      const indexFileUrl = `${fileUrl}${indexFileSuffix}`
      const result = applyFileSystemMagicResolution(indexFileUrl, {
        magicDirectoryIndex: false,
        magicExtensions,
      })
      return {
        ...result,
        magicDirectoryIndex: true,
      }
    }
    return {
      found: true,
      url: fileUrl,
      isDirectory: true,
    }
  }
  if (magicExtensions && magicExtensions.length) {
    const parentUrl = new URL("./", fileUrl).href
    const urlFilename = urlToFilename(fileUrl)
    const extensionLeadingToFile = magicExtensions.find((extensionToTry) => {
      const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`
      const stat = fileStatOrNull(urlCandidate)
      return stat
    })
    if (extensionLeadingToFile) {
      // magic extension worked
      return {
        found: true,
        url: `${fileUrl}${extensionLeadingToFile}`,
        magicExtension: extensionLeadingToFile,
      }
    }
  }
  // magic extension not found
  return {
    found: false,
    url: fileUrl,
    lastENOENTError,
  }
}
