export const getBrowserRuntimeReport = async ({
  page,
  coverageHandledFromOutside,
  runtime,
  compileServerId,
}) => {
  const cache = cacheFromParams({
    runtime,
    compileServerId,
    coverageHandledFromOutside,
  })
  const entry = cache.read()
  if (entry) {
    return entry
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
  cache.write(browserRuntimeFeaturesReport)
  return browserRuntimeFeaturesReport
}

let currentCacheParams
let currentCacheValue
const cacheFromParams = ({
  runtime,
  compileServerId,
  coverageHandledFromOutside,
}) => {
  const params = {
    compileServerId,
    coverageHandledFromOutside,
  }
  const runtimeLabel = `${runtime.name}/${runtime.version}`

  if (!currentCacheParams) {
    currentCacheParams = params
    currentCacheValue = {}
    return {
      read: () => null,
      write: (value) => {
        currentCacheValue[runtimeLabel] = value
      },
    }
  }

  if (JSON.stringify(currentCacheParams) !== JSON.stringify(params)) {
    return {
      read: () => null,
      write: (value) => {
        currentCacheParams = params
        currentCacheValue = {}
        currentCacheValue[runtimeLabel] = value
      },
    }
  }

  return {
    read: () => currentCacheValue[runtimeLabel],
    write: (value) => {
      currentCacheValue[runtimeLabel] = value
    },
  }
}
