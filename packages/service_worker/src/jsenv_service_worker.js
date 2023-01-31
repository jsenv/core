/**
 * https://web.dev/service-worker-caching-and-http-caching/
 * https://stackoverflow.com/questions/33262385/service-worker-force-update-of-new-assets/64880568#64880568
 * https://gomakethings.com/how-to-set-an-expiration-date-for-items-in-a-service-worker-cache/
 * https://phyks.me/2019/01/manage-expiration-of-cached-assets-with-service-worker-caching.html

 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *
 * Do not use relative self.importScripts in there because
 * They are resolved against self.location. It means
 * ./file.js would be resolved against the project root
*/

/* env serviceworker */
/* globals self */

self.initJsenvServiceWorker = ({
  /**
   * logLevel can be "debug", "info", "warn", "error"
   */
  logLevel = "warn",
  logsBackgroundColor = "#ffdc00", // nice yellow

  /*
   * cachePrefix is used to generate a unique cache name in the navigator such as:
   * "jsenvjld2cjxh0000qzrmn831i7rn"
   * The prefix is used to identify which cache have been created by this service worker
   * so that the next service worker can cleanup cache.
   */
  cachePrefix = "jsenv",

  /*
   * When installed, service worker will try to put a list of urls into browser cache.
   * This is done in "install" function
   * Urls will be cached as long as service worker is alive.
   */
  urlsConfig = {
    "/": {},
  },

  /*
   * Decides if the request will be handled by the service worker or not.
   * When returning true, the response for that request will come from cache. If not cached
   * response is fetched from network and put into cache.
   * When returning false, the default navigator behaviour applies, as if there was no service worker.
   *
   * The implementation below means only GET or HEAD requests cached during install
   * are handled by the service worker.
   */
  shouldHandleRequest = (request, { requestWasCachedOnInstall }) => {
    if (request.method !== "GET" && request.method !== "HEAD") return false
    return requestWasCachedOnInstall
  },

  /*
   * Whenever you change something in this file browser reinstalls the service worker.
   * When service worker activates, it is responsible to clean the cache
   * used by the previous service worker version.
   *
   * This logic must be implemented using config.shouldCleanOnActivate
   * function below.
   *
   * shouldCleanOnActivate(response, request)
   *
   * It is a function that will be used to decide if a cached response must be deleted
   * when service worker activates.
   *
   * The implementation below tells to delete cache for any request not cached during install.
   * It means that every request where "shouldHandleRequest" returned true
   * in the previous worker but false in the new worker, that request cached is deleted.
   */
  shouldCleanOnActivate = (
    response,
    request,
    { requestWasCachedOnInstall },
  ) => {
    return !requestWasCachedOnInstall
  },

  /**
   * navigationPreloadEnabled is experimental
   */
  navigationPreloadEnabled = false,

  /**
   * actions can be used to create code that can be executed in the service worker
   * when parent page ask him to do so. It's for super advanced use cases.
   */
  actions = {
    ping: () => "pong",
  },
} = {}) => {
  if (typeof urlsConfig !== "object") {
    throw new TypeError(`urlsConfig should be an object, got ${urlsConfig}`)
  }
  if (typeof cachePrefix !== "string") {
    throw new TypeError(`cachePrefix should be a string, got ${cachePrefix}`)
  }
  if (cachePrefix.length === 0) {
    throw new TypeError(`cachePrefix must not be empty`)
  }
  if (typeof shouldCleanOnActivate !== "function") {
    throw new TypeError(
      `shouldCleanOnActivate should be a function, got ${shouldCleanOnActivate}`,
    )
  }
  if (typeof shouldHandleRequest !== "function") {
    throw new TypeError(
      `shouldHandleRequest should be a function, got ${shouldHandleRequest}`,
    )
  }
  if (typeof logLevel !== "string") {
    throw new TypeError(`logLevel should be a boolean, got ${logLevel}`)
  }
  if (typeof logsBackgroundColor !== "string") {
    throw new TypeError(
      `logsBackgroundColor should be a string, got ${logsBackgroundColor}`,
    )
  }
  if (typeof navigationPreloadEnabled !== "boolean") {
    throw new TypeError(
      `navigationPreloadEnabled should be a boolean, got ${navigationPreloadEnabled}`,
    )
  }

  const cacheName = getCacheName({ cachePrefix })
  const logger = createLogger({ logLevel, logsBackgroundColor })
  const urlResolver = createUrlResolver()
  const { urlsToCacheOnInstall, urlsToReloadOnInstall, urlMapping } =
    createUrlActions({
      urlsConfig,
      urlResolver,
    })
  logger.info(`cache key: ${cacheName}`)

  // --- installation phase ---
  self.addEventListener("install", (installEvent) => {
    installEvent.waitUntil(install(installEvent))
  })
  const install = async () => {
    logger.info("install start")
    try {
      const total = urlsToCacheOnInstall.length
      let installed = 0
      await Promise.all(
        urlsToCacheOnInstall.map(async (url) => {
          try {
            const requestUrlsInUrlsToReloadOnInstall =
              urlsToReloadOnInstall.includes(url)
            const request = new Request(url, {
              ...(requestUrlsInUrlsToReloadOnInstall
                ? {
                    // A non versioned url must ignore navigator cache
                    // otherwise we might (99% chances) hit previous worker cache
                    // and miss the new version
                    cache: "reload",
                  }
                : {
                    // If versioned url is the same as before, it's ok to reuse
                    // cache from previous worker or navigator itself.
                  }),
            })
            await fetchAndCache(request, {
              oncache: () => {
                installed += 1
              },
            })
          } catch (e) {
            logger.warn(
              `cannot put ${url} in cache due to error while fetching: ${e.stack}`,
            )
          }
        }),
      )
      if (installed === total) {
        logger.info(`install done (${total} urls added in cache)`)
      } else {
        logger.info(`install done (${installed}/${total} urls added in cache)`)
      }
    } catch (error) {
      logger.error(`install error: ${error.stack}`)
    }
  }

  // --- fetch implementation ---
  self.addEventListener("fetch", (fetchEvent) => {
    const request = remapRequest(fetchEvent.request)
    if (
      shouldHandleRequest(request, {
        requestWasCachedOnInstall: urlsToCacheOnInstall.includes(request.url),
      })
    ) {
      const responsePromise = handleRequest(request, fetchEvent)
      if (responsePromise) {
        fetchEvent.respondWith(responsePromise)
      }
    }
  })
  const handleRequest = async (request, fetchEvent) => {
    logger.debug(`received fetch event for ${request.url}`)
    try {
      const responseFromCache = await self.caches.match(request)
      if (responseFromCache) {
        logger.debug(`respond with response from cache for ${request.url}`)
        return responseFromCache
      }

      const responsePreloaded = await fetchEvent.preloadResponse
      if (responsePreloaded) {
        logger.debug(`respond with preloaded response for ${request.url}`)
        return responsePreloaded
      }
    } catch (error) {
      logger.warn(
        `error while trying to use cache for ${request.url}`,
        error.stack,
      )
      return fetch(request)
    }

    logger.debug(`no cache for ${request.url}, fetching it`)
    return fetchAndCache(request)
  }
  const remapRequest = (request) => {
    if (Object.prototype.hasOwnProperty.call(urlMapping, request.url)) {
      const newUrl = urlMapping[request.url]
      logger.debug(`redirect request from ${request.url} to ${newUrl}`)
      return redirectRequest(request, newUrl)
    }
    return request
  }

  // --- activation phase ---
  self.addEventListener("activate", (activateEvent) => {
    const activatePromise = activate(activateEvent)
    if (activatePromise) {
      activateEvent.waitUntil(activatePromise)
    }
  })
  const activate = async () => {
    logger.info("activate start")
    await Promise.all([
      enableNavigationPreloadIfPossible(),
      deleteOtherUrls(),
      deleteOtherCaches(),
    ])
    logger.info("activate done")
  }
  const enableNavigationPreloadIfPossible = async () => {
    if (navigationPreloadEnabled && self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable()
    }
  }
  const deleteOtherUrls = async () => {
    const cache = await self.caches.open(cacheName)
    const requestsInCache = await cache.keys()
    await Promise.all(
      requestsInCache.map(async (requestInCache) => {
        const responseInCache = await cache.match(requestInCache)
        if (
          shouldCleanOnActivate(responseInCache, requestInCache, {
            requestWasCachedOnInstall: urlsToCacheOnInstall.includes(
              requestInCache.url,
            ),
          })
        ) {
          logger.info(`delete ${requestInCache.url}`)
          await cache.delete(requestInCache)
        }
      }),
    )
  }
  const deleteOtherCaches = async () => {
    const cacheKeys = await self.caches.keys()
    await Promise.all(
      cacheKeys.map(async (cacheKey) => {
        if (cacheKey !== cacheName && cacheKey.startsWith(cachePrefix)) {
          logger.info(`delete cache ${cacheKey}`)
          await self.caches.delete(cacheKey)
        }
      }),
    )
  }

  // --- postMessage communication ---
  self.addEventListener("message", async (messageEvent) => {
    const { data } = messageEvent
    if (typeof data !== "object") {
      return
    }
    const { action } = data
    const actionFn = actions[action]
    if (!actionFn) {
      return
    }
    const { payload } = data
    let status
    let value
    try {
      const actionFnReturnValue = await actionFn(payload, { cacheName })
      status = "resolved"
      value = actionFnReturnValue
    } catch (e) {
      status = "rejected"
      value = e
    }
    messageEvent.ports[0].postMessage({ status, value })
  })
  actions = {
    skipWaiting: () => {
      self.skipWaiting()
    },
    refreshCacheKey: async (url) => {
      url = urlResolver.resolve(url)
      const response = await fetchAndCache(
        new Request(url, { cache: "reload" }),
      )
      return response.status
    },
    addCacheKey: async (url) => {
      url = urlResolver.resolve(url)
      const response = await fetchAndCache(url)
      return response.status
    },
    removeCacheKey: async (url) => {
      url = urlResolver.resolve(url)
      const cache = await self.caches.open(cacheName)
      const deleted = await cache.delete(url)
      return deleted
    },
    ...actions,
  }
  const fetchAndCache = async (request, { oncache } = {}) => {
    const [response, cache] = await Promise.all([
      fetchUsingNetwork(request),
      getCache(),
    ])

    if (response.status === 200) {
      logger.debug(
        `fresh response found for ${request.url}, put it in cache and respond with it`,
      )

      const responseForCache = await responseToResponseForCache(response)
      const cacheWrittenPromise = cache.put(request, responseForCache)
      if (oncache) {
        await cacheWrittenPromise
        oncache()
      }

      return response
    }
    logger.warn(
      `cannot put ${request.url} in cache due to response status (${response.status})`,
    )
    return response
  }
  const responseToResponseForCache = async (response) => {
    const responseClone = response.clone()

    if (!response.redirected) {
      return responseClone
    }

    // When passed a redirected response, this will create a new, "clean" response
    // that can be used to respond to a navigation request.
    // See https://bugs.chromium.org/p/chromium/issues/detail?id=669363&desc=2#c1

    // Not all browsers support the Response.body stream, so fall back to reading
    // the entire body into memory as a blob.
    const bodyPromise =
      "body" in responseClone
        ? Promise.resolve(responseClone.body)
        : responseClone.blob()

    const body = await bodyPromise
    // new Response() is happy when passed either a stream or a Blob.
    return new Response(body, {
      headers: responseClone.headers,
      status: responseClone.status,
      statusText: responseClone.statusText,
    })
  }
  const fetchUsingNetwork = async (request) => {
    const controller = new AbortController()
    const { signal } = controller

    try {
      const response = await fetch(request, { signal })
      return response
    } catch (e) {
      // abort request in any case
      // I don't know how useful this is ?
      controller.abort()
      throw e
    }
  }
  const getCache = async () => {
    const cache = await self.caches.open(cacheName)
    return cache
  }
}

const createLogger = ({ logLevel, logsBackgroundColor }) => {
  const prefixArgs = (...args) => {
    return [
      `%csw`,
      `background: ${logsBackgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ]
  }

  const createLogMethod =
    (method) =>
    (...args) =>
      console[method](...prefixArgs(...args))

  const debug = createLogMethod("debug")
  const info = createLogMethod("info")
  const warn = createLogMethod("warn")
  const error = createLogMethod("error")
  const noop = () => {}

  if (logLevel === "debug") {
    return {
      debug,
      info,
      warn,
      error,
    }
  }

  if (logLevel === "info") {
    return {
      debug: noop,
      info,
      warn,
      error,
    }
  }

  if (logLevel === "warn") {
    return {
      debug: noop,
      info: noop,
      warn,
      error,
    }
  }

  if (logLevel === "error") {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error,
    }
  }

  if (logLevel === "off") {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    }
  }

  throw new Error(`unknown logLevel, got ${logLevel}`)
}

const getCacheName = ({ cachePrefix }) => {
  return `${cachePrefix}${generateCacheId()}`
}
const base = 36
const blockSize = 4
const discreteValues = Math.pow(base, blockSize)
const pad = (number, size) => {
  var s = `000000000${number}`
  return s.substr(s.length - size)
}
const getRandomValue = (() => {
  const { crypto } = self
  if (crypto) {
    const lim = Math.pow(2, 32) - 1
    return () => {
      return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim)
    }
  }
  return Math.random
})()
const randomBlock = () => {
  return pad(
    ((getRandomValue() * discreteValues) << 0).toString(base),
    blockSize,
  )
}
const generateCacheId = () => {
  const timestamp = new Date().getTime().toString(base)
  const random = `${randomBlock()}${randomBlock()}`
  return `${timestamp}${random}`
}

const createUrlResolver = () => {
  const resolve = (string) => String(new URL(string, self.location))
  return { resolve }
}

const createUrlActions = ({ urlsConfig, urlResolver }) => {
  const urlsToCacheOnInstall = []
  const urlsToReloadOnInstall = []
  const urlMapping = {}
  const urls = []
  Object.keys(urlsConfig).forEach((key) => {
    const url = urlResolver.resolve(key)
    if (urls.includes(url)) {
      return
    }
    urls.push(url)

    let urlConfig = urlsConfig[key]
    if (!urlConfig) urlConfig = { cache: false }
    if (urlConfig === true) urlConfig = { cache: true }
    const { cache = true, versioned = false, alias } = urlConfig

    if (cache) {
      urlsToCacheOnInstall.push(url)
      if (!versioned) {
        urlsToReloadOnInstall.push(url)
      }
    }
    if (alias) {
      urlMapping[url] = urlResolver.resolve(alias)
    }
  })
  return {
    urlsToCacheOnInstall,
    urlsToReloadOnInstall,
    urlMapping,
  }
}

const redirectRequest = async (request, url) => {
  const { mode } = request
  // see https://github.com/GoogleChrome/workbox/issues/1796
  if (mode !== "navigate") {
    return new Request(url, request)
  }

  const requestClone = request.clone()
  const { body, credentials, headers, integrity, referrer, referrerPolicy } =
    requestClone
  const bodyPromise = body ? Promise.resolve(body) : requestClone.blob()
  const bodyValue = await bodyPromise

  const requestMutated = new Request(url, {
    body: bodyValue,
    credentials,
    headers,
    integrity,
    referrer,
    referrerPolicy,
    mode: "same-origin",
    redirect: "manual",
  })
  return requestMutated
}

// const responseUsesLongTermCaching = (responseInCache) => {
//   const cacheControlResponseHeader =
//     responseInCache.headers.get("cache-control")
//   const maxAge = parseMaxAge(cacheControlResponseHeader)
//   return maxAge && maxAge > 0
// }
// // https://github.com/tusbar/cache-control
// const parseMaxAge = (cacheControlHeader) => {
//   if (!cacheControlHeader || cacheControlHeader.length === 0) {
//     return null
//   }
//   const HEADER_REGEXP =
//     /([a-zA-Z][a-zA-Z_-]*)\s*(?:=(?:"([^"]*)"|([^ \t",;]*)))?/g
//   const matches = cacheControlHeader.match(HEADER_REGEXP) || []
//   const values = {}
//   Array.from(matches).forEach((match) => {
//     const tokens = match.split("=", 2)

//     const [key] = tokens
//     let value = null

//     if (tokens.length > 1) {
//       value = tokens[1].trim()
//     }

//     values[key.toLowerCase()] = value
//   })
//   return parseDuration(values["max-age"])
// }
// const parseDuration = (value) => {
//   if (!value) {
//     return null
//   }
//   const duration = Number.parseInt(value, 10)
//   if (!Number.isFinite(duration) || duration < 0) {
//     return null
//   }
//   return duration
// }
