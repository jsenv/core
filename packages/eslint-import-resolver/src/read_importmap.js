import { readFileSync } from "node:fs"
import { normalizeImportMap } from "@jsenv/importmap"
import { urlIsInsideOf, urlToFileSystemPath } from "@jsenv/filesystem"

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
  const importmapFilePath = urlToFileSystemPath(importmapFileUrl)
  try {
    importmapFileBuffer = readFileSync(importmapFilePath)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      logger.error(`importmap file not found at ${importmapFilePath}`)
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
${importmapFilePath}`)
      return null
    }
    throw e
  }
  return normalizeImportMap(importMap, importmapFileUrl)
}
