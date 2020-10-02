import { basename } from "path"
import { urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { computeFileUrlForCaching } from "./computeFileUrlForCaching.js"
import { replaceCssUrls } from "./replaceCssUrls.js"
import { fetchCssAssets } from "./fetchCssAssets.js"

export const transformCssFiles = async (cssDependencies, options) => {
  const assetSources = await fetchCssAssets(cssDependencies)
  const assetUrlMappings = await remapCssAssetUrls(assetSources)

  const cssUrlMappings = {}
  const cssContentMappings = {}

  const cssFilesOrderedByDependency = getCssFilesOrderedBydependency(cssDependencies)
  await cssFilesOrderedByDependency.reduce(async (previous, cssFile) => {
    await previous

    const cssBeforeTransformation = cssDependencies[cssFile].source
    // we cannot compute url for caching of the css file because
    // we will modify its content but we know where it's supposed to be written
    // postCSS needs this infromation for the sourcemap
    // once we will know the final css name with hash
    // we will update the sourcemap.file and sourcemap comment to add the hash
    const urlsReplacements = makeUrlReplacementsRelativeToCssFile(
      {
        ...assetUrlMappings,
        ...cssUrlMappings,
      },
      cssFile,
    )

    const cssReplaceResult = await replaceCssUrls(
      cssBeforeTransformation,
      cssFile,
      urlsReplacements,
      options,
    )
    let cssAfterTransformation = cssReplaceResult.css
    const cssAfterTransformationMap = cssReplaceResult.map.toJSON()
    const cssAfterTransformationFileUrl = computeFileUrlForCaching(cssFile, cssAfterTransformation)
    cssUrlMappings[cssFile] = cssAfterTransformationFileUrl

    const cssSourceMapFileUrl = `${cssAfterTransformationFileUrl}.map`
    const cssSourceMapFileUrlRelativeToSource = urlToRelativeUrl(
      cssSourceMapFileUrl,
      cssAfterTransformationFileUrl,
    )
    cssAfterTransformationMap.file = basename(urlToFileSystemPath(cssAfterTransformationFileUrl))
    cssAfterTransformation = setCssSourceMappingUrl(
      cssAfterTransformation,
      cssSourceMapFileUrlRelativeToSource,
    )

    cssContentMappings[cssFile] = {
      css: cssAfterTransformation,
      map: cssAfterTransformationMap,
    }
  }, Promise.resolve())

  return {
    assetUrlMappings,
    assetSources,
    cssUrlMappings,
    cssContentMappings,
  }
}

const makeUrlReplacementsRelativeToCssFile = (urlsReplacements, cssFileUrl) => {
  const relative = {}
  Object.keys(urlsReplacements).forEach((key) => {
    const urlReplacement = urlsReplacements[key]
    relative[key] = `./${urlToRelativeUrl(urlReplacement, cssFileUrl)}`
  })
  return relative
}

const remapCssAssetUrls = (assetSources) => {
  const assetUrlMappings = {}

  Object.keys(assetSources).map(async (assetUrl) => {
    assetUrlMappings[assetUrl] = computeFileUrlForCaching(assetUrl, assetSources[assetUrl])
  })

  return assetUrlMappings
}

const getCssFilesOrderedBydependency = (cssDependencies) => {
  const cssFilesOrderedByDependency = []

  const visitRemainingFiles = (remainingFiles) => {
    if (remainingFiles.length === 0) return

    const filesToHandle = []
    remainingFiles.forEach((cssFile) => {
      const { importUrls } = cssDependencies[cssFile]
      const allDependenciesResolved = importUrls.every((cssUrl) =>
        cssFilesOrderedByDependency.includes(cssUrl),
      )
      if (allDependenciesResolved) {
        cssFilesOrderedByDependency.push(cssFile)
      } else {
        filesToHandle.push(cssFile)
      }
    })

    if (filesToHandle.length) {
      visitRemainingFiles(filesToHandle)
    }
  }

  visitRemainingFiles(Object.keys(cssDependencies))

  return cssFilesOrderedByDependency
}
