import { statSync } from "node:fs"

import { urlToFilename } from "./url_utils.js"

export const applyFileSystemMagicResolution = (
  fileUrl,
  { magicDirectoryIndex, magicExtensions },
) => {
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
        magicDirectoryIndex: true,
        ...result,
      }
    }
    return {
      isDirectory: true,
      found: true,
      url: fileUrl,
    }
  }
  const extensionLeadingToAFile = findExtensionLeadingToFile(
    fileUrl,
    magicExtensions,
  )
  // magic extension not found
  if (extensionLeadingToAFile) {
    // magic extension worked
    return {
      magicExtension: extensionLeadingToAFile,
      found: true,
      url: `${fileUrl}${extensionLeadingToAFile}`,
    }
  }
  return {
    found: false,
    url: fileUrl,
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
    const stat = fileStatOrNull(urlCandidate)
    return stat
  })
  return extensionLeadingToFile
}

const fileStatOrNull = (url) => {
  try {
    return statSync(new URL(url))
  } catch (e) {
    if (e.code === "ENOENT") {
      return null
    }
    throw e
  }
}
