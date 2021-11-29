let cacheKey
let runtimeReportCache = {}

export const getBrowserRuntimeReport = async ({
  page,
  coverageHandledFromOutside,
  runtime,
  compileServerId,
}) => {
  const runtimeLabel = `${runtime.name}/${runtime.version}`
  if (compileServerId === cacheKey) {
    const fromCache = runtimeReportCache[runtimeLabel]
    if (fromCache) {
      return fromCache
    }
  } else {
    cacheKey = null
    runtimeReportCache = {}
  }

  const browserRuntimeFeaturesReport = await page.evaluate(
    /* istanbul ignore next */
    async ({ coverageHandledFromOutside }) => {
      // eslint-disable-next-line no-undef
      await window.readyPromise

      // eslint-disable-next-line no-undef
      return window.scanBrowserRuntimeFeatures({
        coverageHandledFromOutside,
        failFastOnFeatureDetection: true,
      })
    },
    { coverageHandledFromOutside },
  )
  runtimeReportCache[runtimeLabel] = browserRuntimeFeaturesReport
  return browserRuntimeFeaturesReport
}
