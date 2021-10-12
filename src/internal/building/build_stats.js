import { resolveUrl, urlToExtension } from "@jsenv/filesystem"

import { isReferencedOnlyByRessourceHint } from "./ressource_builder_util.js"

export const createBuildStats = ({
  buildFileContents,
  ressourceBuilder,
  buildDuration,
}) => {
  const projectFileContents = getProjectFileContents(ressourceBuilder)
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

const getProjectFileContents = (ressourceBuilder) => {
  const projectFileContents = {}
  const { ressourceMap } = ressourceBuilder.inspect()

  Object.keys(ressourceMap).forEach((url) => {
    const ressource = ressourceMap[url]
    const { isInline, isExternal, isPlaceholder, bufferBeforeBuild } = ressource
    if (isInline) {
      // inline ressources are not files
      return
    }
    if (isExternal) {
      // external ressource are not handled, we would not have the bufferBeforeBuild
      return
    }
    if (isReferencedOnlyByRessourceHint(ressource)) {
      // ressource is only referenced by ressource hint (link preload for example)
      // it's never actually loaded
      // -> we don't gave the bufferBeforeBuild (the ressource file content)
      return
    }
    if (isPlaceholder) {
      // placeholders (used for sourcemap files)
      // means the file did not exists in the project is there is a placeholder
      // to generate it in the build
      return
    }
    projectFileContents[url] = bufferBeforeBuild
  })
  return projectFileContents
}
