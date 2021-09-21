import { resolveUrl, urlToExtension } from "@jsenv/filesystem"

import { ressourceIsReferencedOnlyByRessourceHint } from "./asset-builder.util.js"

export const createBuildStats = ({
  buildFileContents,
  assetBuilder,
  buildDuration,
}) => {
  const projectFileContents = getProjectFileContents(assetBuilder)
  const projectFileSizeInfo = sizeInfoFromFileContents(projectFileContents)

  const { sourceFileContents, sourcemapFileContents } =
    extractSourcemapFiles(buildFileContents)
  const buildFileSizeInfo = sizeInfoFromFileContents(sourceFileContents)
  const sourcemapFileSizeInfo = sizeInfoFromFileContents(sourcemapFileContents)

  return {
    projectFileSizes: projectFileSizeInfo.fileSizes,
    projectTotalFileSize: projectFileSizeInfo.totalSize,
    buildFileSizes: buildFileSizeInfo.fileSizes,
    buildTotalFileSize: buildFileSizeInfo.totalSize,
    buildSourcemapFileSizes: sourcemapFileSizeInfo.fileSizes,
    buildDuration,
  }
}

const extractSourcemapFiles = (fileContents) => {
  const sourceFileContents = {}
  const sourcemapFileContents = {}
  Object.keys(fileContents).forEach((key) => {
    const url = resolveUrl(key, "http://example.com")
    if (urlToExtension(url) === ".map") {
      sourcemapFileContents[key] = fileContents[key]
    } else {
      sourceFileContents[key] = fileContents[key]
    }
  })
  return {
    sourceFileContents,
    sourcemapFileContents,
  }
}

const sizeInfoFromFileContents = (fileContents) => {
  const fileSizes = {}
  let totalSize = 0
  Object.keys(fileContents).forEach((key) => {
    const fileSize = Buffer.byteLength(fileContents[key])
    fileSizes[key] = fileSize
    totalSize += fileSize
  })
  return { fileSizes, totalSize }
}

const getProjectFileContents = (assetBuilder) => {
  const projectFileContents = {}
  const { ressourceMap } = assetBuilder.inspect()

  Object.keys(ressourceMap).forEach((url) => {
    const target = ressourceMap[url]
    const { isInline, isExternal, bufferBeforeBuild } = target
    if (isInline) {
      // inline ressources are not files
      return
    }
    if (isExternal) {
      // external target are not handled, we would not have the bufferBeforeBuild
      return
    }
    if (ressourceIsReferencedOnlyByRessourceHint(target)) {
      // target is only referenced by ressource hint (link preload for example)
      // it's never actually loaded-> we don't gave the bufferBeforeBuild (the ressource file content)
      return
    }
    projectFileContents[url] = bufferBeforeBuild
  })
  return projectFileContents
}
