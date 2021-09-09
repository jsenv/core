import { createDetailedMessage } from "@jsenv/logger"
import { urlToFileSystemPath } from "@jsenv/filesystem"

import { getHtmlNodeLocation } from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { showSourceLocation } from "./showSourceLocation.js"

export const formatBuildStartLog = ({ entryPointMap }) => {
  const entryProjectRelativeUrls = Object.keys(entryPointMap)
  const entryCount = entryProjectRelativeUrls.length

  if (entryCount === 1) {
    return `build start for ${entryProjectRelativeUrls[0]}`
  }

  return `build start for ${entryCount} files:
- ${entryProjectRelativeUrls.join(`
- `)}`
}

export const formatUseImportMapFromHtml = (importMapInfoFromHtml) => {
  return `
use importmap found in ${showHtmlSourceLocation(importMapInfoFromHtml)}`
}

export const formatImportmapOutsideCompileDirectory = ({ importMapInfo, compileDirectoryUrl }) => {
  return `
WARNING: importmap file is outside compile directory.
That's unusual you should certainly make importmap file relative.
${showHtmlSourceLocation(importMapInfo)}
--- compile directory url ---
${compileDirectoryUrl}
`
}

export const formatFileNotFound = (url, importer) => {
  return createDetailedMessage(`A file cannot be found.`, {
    file: urlToFileSystemPath(url),
    ["imported by"]:
      importer.startsWith("file://") && !importer.includes("\n")
        ? urlToFileSystemPath(importer)
        : importer,
  })
}

export const formatRessourceHintNeverUsedWarning = (linkInfo) => {
  return `
WARNING: Ressource never used for ${linkInfo.rel} link in ${showHtmlSourceLocation(linkInfo)}
`
}

export const formatBuildDoneInfo = ({ rollupBuild, buildDirectoryRelativeUrl }) => {
  return `
${createDetailedMessage(
  `build end`,
  formatBuildDoneDetails({ rollupBuild, buildDirectoryRelativeUrl }),
)}
`
}

const formatBuildDoneDetails = ({ rollupBuild, buildDirectoryRelativeUrl }) => {
  const assetFilenames = Object.keys(rollupBuild)
    .filter((key) => rollupBuild[key].type === "asset")
    .map((key) => `${buildDirectoryRelativeUrl}${key}`)
  const assetCount = assetFilenames.length

  const chunkFilenames = Object.keys(rollupBuild)
    .filter((key) => rollupBuild[key].type === "chunk")
    .map((key) => `${buildDirectoryRelativeUrl}${key}`)
  const chunkCount = chunkFilenames.length

  const assetDescription =
    // eslint-disable-next-line no-nested-ternary
    assetCount === 0 ? "" : assetCount === 1 ? "1 asset" : `${assetCount} assets`
  const chunkDescription =
    // eslint-disable-next-line no-nested-ternary
    chunkCount === 0 ? "" : chunkCount === 1 ? "1 chunk" : `${chunkCount} chunks`

  return {
    ...(assetDescription ? { [assetDescription]: assetFilenames } : {}),
    ...(chunkDescription ? { [chunkDescription]: chunkFilenames } : {}),
  }
}

const showHtmlSourceLocation = ({ htmlNode, htmlUrl, htmlSource }) => {
  const { line, column } = getHtmlNodeLocation(htmlNode)

  return `${htmlUrl}:${line}:${column}
${showSourceLocation(htmlSource, {
  line,
  column,
})}
`
}
