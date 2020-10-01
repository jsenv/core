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
    const urlsReplacements = {
      ...assetUrlMappings,
      ...cssUrlMappings,
    }
    const cssFileUrlAfterTransformation = computeFileBundleUrl(cssFile, {
      fileContent: cssBeforeTransformation,
      projectDirectoryUrl,
      bundleDirectoryUrl,
    })
    const cssAfterTransformation = replaceCssUrls(cssBeforeTransformation, urlsReplacements, {
      from: cssFile,
      to: cssFileUrlAfterTransformation,
    })

    cssUrlMappings[cssFile] = cssFileUrlAfterTransformation
    cssContentMappings[cssFile] = cssAfterTransformation
  }, Promise.resolve())

  return {
    cssUrlMappings,
    cssContentMappings,
  }
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
      const { cssUrls } = cssDependencies[cssFile]
      const allDependenciesResolved = cssUrls.every((cssUrl) =>
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
