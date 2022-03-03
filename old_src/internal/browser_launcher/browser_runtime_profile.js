export const getBrowserRuntimeProfile = async ({
  page,
  runtime,
  compileServerId,
  coverageHandledFromOutside,
  forceSource,
  forceCompilation,
}) => {
  const cache = cacheFromParams({
    runtime,
    compileServerId,
    coverageHandledFromOutside,
    forceSource,
    forceCompilation,
  })
  const entry = cache.read()
  if (entry) {
    return entry
  }
  const browserRuntimeProfile = await page.evaluate(
    /* eslint-disable no-undef */
    /* istanbul ignore next */
    async ({ coverageHandledFromOutside, forceSource, forceCompilation }) => {
      await window.readyPromise
      const runtimeProfile = await window.scanBrowserRuntimeFeatures({
        coverageHandledFromOutside,
        forceSource,
        forceCompilation,
      })
      return runtimeProfile
    },
    /* eslint-enable no-undef */
    { coverageHandledFromOutside, forceSource, forceCompilation },
  )
  cache.write(browserRuntimeProfile)
  return browserRuntimeProfile
}

let currentCacheParams
let currentCacheValue
const cacheFromParams = ({
  runtime,
  compileServerId,
  coverageHandledFromOutside,
  forceSource,
  forceCompilation,
}) => {
  const params = {
    compileServerId,
    coverageHandledFromOutside,
    forceSource,
    forceCompilation,
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
