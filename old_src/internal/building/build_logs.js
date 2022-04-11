import { ANSI, UNICODE } from "@jsenv/log"

import { getHtmlNodeLocation } from "@jsenv/core/src/internal/transform_html/html_ast.js"

import { byteAsFileSize } from "../logs/byte_as_file_size.js"
import { msAsDuration } from "../logs/ms_as_duration.js"
import { stringifyUrlSite } from "./url_trace.js"

export const formatBuildStartLog = ({ entryPoints }) => {
  const entryFileRelativeUrls = Object.keys(entryPoints)
  if (entryFileRelativeUrls.length === 1) {
    return `
building ${entryFileRelativeUrls[0]}...`
  }

  return `
building ${entryFileRelativeUrls.length} entry files...`
}

export const formatUseImportMapFromHtml = (importMapInfoFromHtml) => {
  return `
use importmap from html ${showHtmlSourceLocation(importMapInfoFromHtml)}`
}

export const formatImportmapOutsideCompileDirectory = ({
  importMapInfo,
  compileDirectoryUrl,
}) => {
  return `
WARNING: importmap file is outside compile directory.
That's unusual you should certainly make importmap file relative.
${showHtmlSourceLocation(importMapInfo)}
--- compile directory url ---
${compileDirectoryUrl}
`
}

export const formatRessourceHintNeverUsedWarning = (linkInfo) => {
  return `
WARNING: Ressource never used for ${
    linkInfo.rel
  } link in ${showHtmlSourceLocation(linkInfo)}
`
}

export const formatBuildDoneInfo = ({
  buildStats,
  buildDirectoryRelativeUrl,
}) => {
  return `${formatBuildDoneDetails({ buildStats, buildDirectoryRelativeUrl })}
${formatBuildSummary({ buildStats })}
${UNICODE.OK} build end
`
}

const formatBuildDoneDetails = ({ buildStats, buildDirectoryRelativeUrl }) => {
  const { buildFileSizes } = buildStats
  const buildFiles = Object.keys(buildFileSizes).map((key) => {
    const buildFileSize = buildFileSizes[key]
    return `${buildDirectoryRelativeUrl}${key} (${byteAsFileSize(
      buildFileSize,
    )})`
  })
  const buildFileCount = buildFiles.length
  const { buildSourcemapFileSizes } = buildStats
  const sourcemapFileCount = Object.keys(buildSourcemapFileSizes).length
  let buildFilesDescription =
    buildFileCount === 1 ? "build file" : `build files`
  if (sourcemapFileCount === 1) {
    buildFilesDescription += ` (excluding sourcemap file)`
  } else if (sourcemapFileCount > 1) {
    buildFilesDescription += ` (excluding sourcemap files)`
  }
  let message = `--- ${buildFilesDescription} ---
${buildFiles.join("\n")}`
  return message
}

const formatBuildSummary = ({ buildStats }) => {
  const {
    buildDuration,
    projectFileSizes,
    projectTotalFileSize,
    buildFileSizes,
    buildFileTotalSize,
    buildSourcemapFileSizes,
    buildSourcemapFileTotalSize,
  } = buildStats

  const projectFileCount = Object.keys(projectFileSizes).length
  const buildFileCount = Object.keys(buildFileSizes).length
  const buildSourcemapFileCount = Object.keys(buildSourcemapFileSizes).length

  return `------- build summary -------
${formatSummaryContent({
  "project files": `${projectFileCount} (${byteAsFileSize(
    projectTotalFileSize,
  )})`,
  "build files": `${buildFileCount} (${byteAsFileSize(buildFileTotalSize)})`,
  ...(buildSourcemapFileCount === 0
    ? {}
    : {
        "build sourcemap files": `${buildSourcemapFileCount} (${byteAsFileSize(
          buildSourcemapFileTotalSize,
        )})`,
      }),
  "build duration": msAsDuration(buildDuration),
})}
------------------------------`
}

const formatSummaryContent = (summaryData) => {
  return Object.keys(summaryData).map((key) => {
    return `${ANSI.color(`${key}:`, ANSI.GREY)} ${summaryData[key]}`
  }).join(`
`)
}

const showHtmlSourceLocation = ({
  htmlNode,
  htmlUrl,
  htmlSource,
  htmlAttributeName,
}) => {
  const { line, column } =
    getHtmlNodeLocation(htmlNode, htmlAttributeName) || {}

  return stringifyUrlSite({
    url: htmlUrl,
    line,
    column,
    source: htmlSource,
  })
}
