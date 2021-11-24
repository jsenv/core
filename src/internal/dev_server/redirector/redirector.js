import { scanBrowserRuntimeFeatures } from "../../runtime/createBrowserRuntime/scanBrowserRuntimeFeatures.js"

const redirect = async () => {
  const redirectTarget = new URLSearchParams(window.location.search).get(
    "redirect",
  )
  const browserRuntimeFeaturesReport = await scanBrowserRuntimeFeatures({
    failFastOnFeatureDetection: true,
  })

  const href = `${getDirectoryUrl(
    browserRuntimeFeaturesReport,
  )}${redirectTarget}`
  // It's IMPORTANT to use location.replace and NOT location.href = url
  // otherwise it would break the back button
  window.location.replace(href)
}

const getDirectoryUrl = ({
  canAvoidCompilation,
  outDirectoryRelativeUrl,
  compileId,
}) => {
  if (canAvoidCompilation) {
    return `/`
  }
  return `/${outDirectoryRelativeUrl}${compileId}/`
}

redirect()
