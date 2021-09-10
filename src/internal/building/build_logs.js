import { getHtmlNodeLocation } from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { setANSIColor, ANSI_GREY, okSign } from "../logs/log_style.js"
import { byteAsFileSize } from "../logs/byteAsFileSize.js"
import { msAsDuration } from "../logs/msAsDuration.js"
import { showSourceLocation } from "./showSourceLocation.js"

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

export const formatRessourceHintNeverUsedWarning = (linkInfo) => {
  return `
WARNING: Ressource never used for ${linkInfo.rel} link in ${showHtmlSourceLocation(linkInfo)}
`
}

export const formatBuildDoneInfo = ({ buildStats, buildDirectoryRelativeUrl }) => {
  return `
${formatBuildDoneDetails({ buildStats, buildDirectoryRelativeUrl })}
${formatBuildSummary({ buildStats })}
${okSign} build end
`
}

const formatBuildDoneDetails = ({ buildStats, buildDirectoryRelativeUrl }) => {
  const { buildFileSizes } = buildStats
  const buildFiles = Object.keys(buildFileSizes).map((key) => {
    const buildFileSize = buildFileSizes[key]
    return `${buildDirectoryRelativeUrl}${key} (${byteAsFileSize(buildFileSize)})`
  })
  const buildFileCount = buildFiles.length

  const { buildSourcemapFileSizes } = buildStats
  const sourcemapFiles = Object.keys(buildSourcemapFileSizes).map((key) => {
    const buildSourcemapFileSize = buildSourcemapFileSizes[key]
    return `${buildDirectoryRelativeUrl}${key} (${byteAsFileSize(buildSourcemapFileSize)})`
  })
  const sourcemapFileCount = sourcemapFiles.length

  const buildFilesDescription =
    buildFileCount === 1 ? "build file" : `build files: ${buildFileCount}`

  const buildSourcemapFilesDescription =
    sourcemapFileCount === 0
      ? ""
      : sourcemapFileCount === 1
      ? "build sourcemap file"
      : `build sourcemap files: ${sourcemapFileCount}`

  let message = `--- ${buildFilesDescription} ---
${buildFiles.join("\n")}`

  if (buildSourcemapFilesDescription) {
    message += `
--- ${buildSourcemapFilesDescription} ---
${sourcemapFiles.join("\n")}`
  }

  return message
}

const formatBuildSummary = ({ buildStats }) => {
  const {
    buildDuration,
    projectFileSizes,
    projectTotalFileSize,
    buildFileSizes,
    buildTotalFileSize,
  } = buildStats

  const projectFileCount = Object.keys(projectFileSizes).length
  const buildFileCount = Object.keys(buildFileSizes).length

  return `------- build summary -------
${setANSIColor(`project files:`, ANSI_GREY)} ${projectFileCount} (${byteAsFileSize(
    projectTotalFileSize,
  )})
${setANSIColor(`build files:`, ANSI_GREY)} ${buildFileCount} (${byteAsFileSize(buildTotalFileSize)})
${setANSIColor(`build duration:`, ANSI_GREY)} ${msAsDuration(buildDuration)}
------------------------------`
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
