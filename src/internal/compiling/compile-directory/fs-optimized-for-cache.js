import { dirname } from "node:path"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"

import { urlToFileSystemPath } from "@jsenv/filesystem"

// readFileSync seems faster than readFile
// and in our case we are talking about a dev server
// in other words it's not super important to handle concurrent connections
// https://gist.github.com/adamhooper/9e0e2583e0f22ace0e0840b9c09e395d
// https://stackoverflow.com/questions/42321861/fs-readfile-is-very-slow-am-i-making-too-many-request
export const readFileContent = async (url) => {
  const buffer = readFileSync(urlToFileSystemPath(url))
  return String(buffer)
}

export const writeFileContent = async (
  url,
  content,
  { fileLikelyNotFound = false } = {},
) => {
  const filePath = urlToFileSystemPath(url)
  const directoryPath = dirname(filePath)

  const ensureParentDirectory = () => {
    try {
      mkdirSync(directoryPath, { recursive: true })
    } catch (error) {
      if (error.code === "EEXIST") {
        return
      }
      throw error
    }
  }

  if (fileLikelyNotFound) {
    // whenever outside knows file is likely not exisiting
    // ensure parent directory exists first
    ensureParentDirectory()
    writeFileSync(filePath, content)
  } else {
    // most of the time when you want to write a file it's likely existing (at least the parent directory)
    try {
      writeFileSync(filePath, content)
    } catch (error) {
      if (error.code === "ENOENT") {
        ensureParentDirectory()
        writeFileSync(filePath, content)
        return
      }
      throw error
    }
  }
}

export const testFilePresence = async (url) => {
  return existsSync(urlToFileSystemPath(url))
}
