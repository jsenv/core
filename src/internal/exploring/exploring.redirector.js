import { scanBrowserRuntimeFeatures } from "../runtime/createBrowserRuntime/scanBrowserRuntimeFeatures.js"

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
  window.location.href = href
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
