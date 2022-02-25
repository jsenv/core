import { statSync } from "node:fs"

import { urlToFilename } from "./url_utils.js"

export const applyFileSystemMagicResolution = (
  fileUrl,
  { magicDirectoryIndex, magicExtensions },
) => {
  const filestats = fileStatsOrNull(fileUrl)
  if (filestats && filestats.isFile()) {
    return {
      found: true,
      url: fileUrl,
    }
  }
  if (filestats && filestats.isDirectory()) {
    if (magicDirectoryIndex) {
      const indexFileSuffix = fileUrl.endsWith("/") ? "index" : "/index"
      const indexFileUrl = `${fileUrl}${indexFileSuffix}`
      const result = applyFileSystemMagicResolution(indexFileUrl, {
        magicDirectoryIndex: false,
        magicExtensions,
      })
      return {
        magicDirectoryIndex: true,
        ...result,
      }
    }
    return {
      isDirectory: true,
      found: false,
      url: fileUrl,
    }
  }
  const extensionLeadingToAFile = findExtensionLeadingToFile(
    fileUrl,
    magicExtensions,
  )
  // magic extension not found
  if (extensionLeadingToAFile === null) {
    return {
      found: false,
      url: fileUrl,
    }
  }
  // magic extension worked
  return {
    magicExtension: extensionLeadingToAFile,
    found: true,
    url: `${fileUrl}${extensionLeadingToAFile}`,
  }
}

const findExtensionLeadingToFile = (fileUrl, magicExtensions) => {
  if (!magicExtensions) {
    return null
  }
  const parentUrl = new URL("./", fileUrl).href
  const urlFilename = urlToFilename(fileUrl)
  const extensionLeadingToFile = magicExtensions.find((extensionToTry) => {
    const urlCandidate = `${parentUrl}${urlFilename}${extensionToTry}`
    const stats = fileStatsOrNull(urlCandidate, {
      nullIfNotFound: true,
    })
    return stats && stats.isFile()
  })
  return extensionLeadingToFile
}

const fileStatsOrNull = (url) => {
  try {
    return statSync(new URL(url))
  } catch (e) {
    if (e.code === "ENOENT") {
      return null
    }
    throw e
  }
}
