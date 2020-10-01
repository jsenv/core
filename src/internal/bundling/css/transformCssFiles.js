import { urlToRelativeUrl } from "@jsenv/util"
import { computeFileBundleUrl } from "./computeFileBundleUrl.js"
import { replaceCssUrls } from "./replaceCssUrls.js"
import { fetchCssAssets } from "./fetchCssAssets.js"

export const transformCssFiles = async (
  cssDependencies,
  { projectDirectoryUrl, bundleDirectoryUrl },
) => {
  const assetSources = await fetchCssAssets(cssDependencies)
  const assetUrlMappings = await remapCssAssetUrls(assetSources, {
    projectDirectoryUrl,
    bundleDirectoryUrl,
  })

  const cssUrlMappings = {}
  const cssContentMappings = {}

  const cssFilesOrderedByDependency = getCssFilesOrderedBydependency(cssDependencies)
  await cssFilesOrderedByDependency.reduce(async (previous, cssFile) => {
    await previous

    const cssBeforeTransformation = cssDependencies[cssFile].source
    const cssFileUrlAfterTransformation = computeFileBundleUrl(cssFile, {
      fileContent: cssBeforeTransformation,
      projectDirectoryUrl,
      bundleDirectoryUrl,
    })
    cssUrlMappings[cssFile] = cssFileUrlAfterTransformation

    const urlsReplacements = makeUrlReplacementsRelativeToCssFile(
      {
        ...assetUrlMappings,
        ...cssUrlMappings,
      },
      cssFileUrlAfterTransformation,
    )

    const cssReplaceResult = await replaceCssUrls(cssBeforeTransformation, urlsReplacements, {
      from: cssFile,
      to: cssFileUrlAfterTransformation,
    })
    const cssAfterTransformation = cssReplaceResult.css
    cssContentMappings[cssFile] = cssAfterTransformation
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

const remapCssAssetUrls = (assetSources, { projectDirectoryUrl, bundleDirectoryUrl }) => {
  const assetUrlMappings = {}

  Object.keys(assetSources).map(async (assetUrl) => {
    assetUrlMappings[assetUrl] = computeFileBundleUrl(assetUrl, {
      fileContent: assetSources[assetUrl],
      projectDirectoryUrl,
      bundleDirectoryUrl,
    })
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
