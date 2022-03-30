import {
  urlIsInsideOf,
  urlToFileSystemPath,
  readFileSync,
} from "@jsenv/filesystem"
import { normalizeImportMap } from "@jsenv/importmap"

import { applyUrlResolution } from "./url_resolution.js"

export const readImportmap = ({
  logger,
  projectDirectoryUrl,
  importmapFileRelativeUrl,
}) => {
  if (typeof importmapFileRelativeUrl === "undefined") {
    return null
  }
  if (typeof importmapFileRelativeUrl !== "string") {
    throw new TypeError(
      `importmapFileRelativeUrl must be a string, got ${importmapFileRelativeUrl}`,
    )
  }
  const importmapFileUrl = applyUrlResolution(
    importmapFileRelativeUrl,
    projectDirectoryUrl,
  )
  if (!urlIsInsideOf(importmapFileUrl, projectDirectoryUrl)) {
    logger.warn(`import map file is outside project.
--- import map file ---
${urlToFileSystemPath(importmapFileUrl)}
--- project directory ---
${urlToFileSystemPath(projectDirectoryUrl)}`)
  }
  let importmapFileBuffer
  try {
    importmapFileBuffer = readFileSync(importmapFileUrl)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      logger.error(`importmap file not found at ${importmapFileUrl}`)
      return null
    }
    throw e
  }
  let importMap
  try {
    const importmapFileString = String(importmapFileBuffer)
    importMap = JSON.parse(importmapFileString)
  } catch (e) {
    if (e && e.code === "SyntaxError") {
      logger.error(`syntax error in importmap file
--- error stack ---
${e.stack}
--- importmap file ---
${importmapFileUrl}`)
      return null
    }
    throw e
  }
  return normalizeImportMap(importMap, importmapFileUrl)
}
