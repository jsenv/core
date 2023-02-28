/* eslint-env serviceworker */
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

self.__sw__ = {}

const sw = self.__sw__
// define self.__sw__.registerActions()
{
  const actions = {}
  self.addEventListener("message", async (messageEvent) => {
    const { data, ports } = messageEvent
    if (typeof data !== "object") {
      return
    }
    const { action } = data
    const actionFn = actions[action]
    if (!actionFn) {
      return
    }
    const { payload } = data
    let actionResultStatus
    let actionResultValue
    try {
      const actionFnReturnValue = await actionFn(payload)
      actionResultStatus = "resolved"
      actionResultValue = actionFnReturnValue
    } catch (e) {
      actionResultStatus = "rejected"
      actionResultValue = e
    }
    ports[0].postMessage({ actionResultStatus, actionResultValue })
  })
  sw.registerActions = (value) => {
    Object.assign(actions, value)
  }
}

// define self.__sw__.init()
{
  sw.init = ({
    /*
     * name will be used to generate a unique cache name in the navigator such as:
     * "jsenv_jld2cjxh0000qzrmn831i7rn"
     * The prefix is used to identify which cache have been created by this service worker
     * so that the next service worker can cleanup cache.
     */
    name = "jsenv",
    /*
     * Version is useful in case hot update is enabled but the new version of the script
     * does not want to be hot-updated. This new version want to control navigator from the start.
     * In that case the version must be updated (incremented for instance)
     * to ensure hot update is cancelled.
     */
    version = "1",
    meta = {},
    /**
     * logLevel can be "debug", "info", "warn", "error"
     */
    logLevel = "warn",
    logBackgroundColor = "#ffdc00", // nice yellow
    logColor = "white",
    /*
     * When installed, service worker will try to put a list of urls into browser cache.
     * This is done in "install" function
     * Urls will be cached as long as service worker is alive.
     */
    resources = {
      "/": {},
    },

    /**
     * actions can be used to create code that can be executed in the service worker
     * when parent page ask him to do so. It's for super advanced use cases.
     */
    actions = {},
    install = () => {},
    activate = () => {},
  } = {}) => {
    if (typeof resources !== "object") {
      throw new TypeError(`resources should be an object, got ${resources}`)
    }
    if (typeof name !== "string") {
      throw new TypeError(`name should be a string, got ${name}`)
    }
    if (name.length === 0) {
      throw new TypeError(`name must not be empty`)
    }
    if (typeof logLevel !== "string") {
      throw new TypeError(`logLevel should be a boolean, got ${logLevel}`)
    }
    if (typeof logBackgroundColor !== "string") {
      throw new TypeError(
        `logBackgroundColor should be a string, got ${logBackgroundColor}`,
      )
    }
    if (typeof logColor !== "string") {
      throw new TypeError(`logColor should be a string, got ${logColor}`)
    }

    const cacheName = createCacheName(name)
    const label = `${name}@${version}(${cacheName})`
    const logger = createLogger({ logLevel, logBackgroundColor, logColor })
    resources = resolveResources(resources)

    // --- init phase ---
    {
      logger.info(`init ${label}`)
      sw.registerActions({
        inspect: () => {
          return {
            name,
            version,
            resources,
            ...meta,
          }
        },
        refreshCacheKey: async (url) => {
          url = asAbsoluteUrl(url)
          const cache = await self.caches.open(cacheName)
          const request = new Request(url, { cache: "reload" })
          return fetchAndPutInCache(request, cache)
        },
        addCacheKey: async (url) => {
          url = asAbsoluteUrl(url)
          const cache = await self.caches.open(cacheName)
          const request = new Request(url)
          return fetchAndPutInCache(request, cache)
        },
        removeCacheKey: async (url) => {
          url = asAbsoluteUrl(url)
          const cache = await self.caches.open(cacheName)
          const deleted = await cache.delete(url)
          return deleted
        },
        ...actions,
      })
    }

    // --- installation phase ---
    {
      sw.registerActions({
        skipWaiting: () => {
          self.skipWaiting()
        },
      })
      self.addEventListener("install", (installEvent) => {
        logger.infoGroupCollapsed(`install ${label}`)
        const installPromise = Promise.all([
          handleInstallEvent(installEvent),
          install(installEvent),
        ])
        installEvent.waitUntil(installPromise)
        installPromise.then(
          () => {
            logger.groupEnd()
          },
          (error) => {
            logger.error(error)
            logger.groupEnd()
          },
        )
      })
      const handleInstallEvent = async () => {
        logger.info(`open cache`)
        const cache = await self.caches.open(cacheName)
        const urlsToCache = Object.keys(resources)
        const total = urlsToCache.length
        let installed = 0
        await Promise.all(
          urlsToCache.map(async (url) => {
            const resource = resources[url]
            const request = resource.versionedUrl
              ? new Request(resource.versionedUrl)
              : // A non versioned url must ignore navigator cache
                // otherwise we might (99% chances) hit previous worker cache
                // and miss the new version
                new Request(url, { cache: "reload" })
            try {
              const response = await fetchAndPutInCache(request, cache)
              if (response.status === 200) {
                logger.info(`put "${asRelativeUrl(request.url)}" into cache`)
                installed += 1
              } else {
                logger.warn(
                  `cannot put ${request.url} into cache due to response status (${response.status})`,
                )
              }
            } catch (e) {
              logger.warn(
                `cannot put ${request.url} in cache due to error while fetching: ${e.stack}`,
              )
            }
          }),
        )
        if (installed === total) {
          logger.info(`install done (${total} resources added in cache)`)
        } else {
          logger.info(
            `install done (${installed}/${total} resources added in cache)`,
          )
        }
      }
    }

    // --- activation phase ---
    {
      self.addEventListener("activate", (activateEvent) => {
        logger.infoGroupCollapsed(`activate ${label}`)
        const activatePromise = Promise.all([
          handleActivateEvent(activateEvent),
          activate(activateEvent),
        ])
        activateEvent.waitUntil(activatePromise)
        activatePromise.then(() => {
          logger.groupEnd()
        })
      })
      sw.registerActions({
        claim: async () => {
          await self.clients.claim()
        },
        postReloadAfterUpdateToClients: async () => {
          const matchingClients = await self.clients.matchAll()
          matchingClients.forEach((matchingClient) => {
            matchingClient.postMessage("reload_after_update")
          })
        },
      })
      const handleActivateEvent = async () => {
        const cacheKeys = await self.caches.keys()
        await Promise.all(
          cacheKeys.map(async (cacheKey) => {
            if (cacheKey !== cacheName && cacheKey.startsWith(`${name}_`)) {
              logger.info(`delete old cache "${cacheKey}"`)
              await self.caches.delete(cacheKey)
            }
          }),
        )
      }
    }

    // --- fetch implementation ---
    {
      self.addEventListener("fetch", (fetchEvent) => {
        fetchEvent.waitUntil(handleFetchEvent(fetchEvent))
      })
      const handleFetchEvent = async (fetchEvent) => {
        const request = fetchEvent.request
        if (request.method !== "GET" && request.method !== "HEAD") {
          return self.fetch(request)
        }
        const resource = resources[request.url]
        const requestWasCachedOnInstall = Boolean(resource)
        if (!requestWasCachedOnInstall) {
          return self.fetch(request)
        }
        const relativeUrl = asRelativeUrl(request.url)
        logger.infoGroupCollapsed(`fetch ${relativeUrl} (${label})`)
        if (request.mode === "navigate") {
          const preloadResponsePromise = fetchEvent.preloadResponse
          if (preloadResponsePromise) {
            logger.debug(
              "preloadResponse available on navigation request, try to use it",
            )
            const preloadResponse = await getPreloadResponse(
              preloadResponsePromise,
            )
            if (preloadResponse) {
              logger.info(`-> use preloaded response`)
              logger.groupEnd()
              return preloadResponse
            }
            logger.debug("cannot use preloadResponse")
          }
        }
        try {
          const request = fetchEvent.request
          logger.debug(`open ${cacheName} cache`)
          const cache = await self.caches.open(cacheName)
          logger.debug(`search response matching this request in cache`)
          const responseFromCache = await cache.match(request)
          if (responseFromCache) {
            logger.info(`found -> use cache`)
            logger.groupEnd()
            return responseFromCache
          }
          logger.info(`not found -> delegate to navigator`)
          logger.groupEnd()
          return self.fetch(request)
        } catch (e) {
          logger.warn(`error while trying to use cache`, e.stack)
          logger.warn("delegate to navigator")
          logger.groupEnd()
          return self.fetch(request)
        }
      }
      const getPreloadResponse = async (preloadResponse) => {
        // see https://github.com/GoogleChrome/workbox/issues/3134
        try {
          const response = await preloadResponse
          if (response && response.type === "error") {
            return null
          }
          return response
        } catch (e) {
          return null
        }
      }
    }
  }
}

const createCacheName = (() => {
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

  return (cachePrefix) => {
    const timestamp = new Date().getTime().toString(base)
    const random = `${randomBlock()}${randomBlock()}`
    return `${cachePrefix}_${timestamp}${random}`
  }
})()

const createLogger = ({ logLevel, logBackgroundColor, logColor }) => {
  const injectLogStyles = (args) => {
    return [
      `%cjsenv %csw`,
      `background: orange; color: white; padding: 1px 3px; margin: 0 1px`,
      `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ]
  }

  const logger = {
    debug: (...args) => {
      if (logLevel === "debug") {
        console.info(...injectLogStyles(args))
      }
    },
    info: (...args) => {
      if (logLevel === "debug" || logLevel === "info") {
        console.info(...injectLogStyles(args))
      }
    },
    warn: (...args) => {
      if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
        console.info(...injectLogStyles(args))
      }
    },
    error: (...args) => {
      if (
        logLevel === "debug" ||
        logLevel === "info" ||
        logLevel === "warn" ||
        logLevel === "error"
      ) {
        console.info(...injectLogStyles(args))
      }
    },
    debugGroupCollapsed: (...args) => {
      if (logLevel === "debug") {
        console.groupCollapsed(...injectLogStyles(args))
      }
    },
    infoGroupCollapsed: (...args) => {
      if (logLevel === "debug" || logLevel === "info") {
        console.groupCollapsed(...injectLogStyles(args))
      }
    },
    groupEnd: () => console.groupEnd(),
  }
  return logger
}

const asAbsoluteUrl = (relativeUrl) =>
  String(new URL(relativeUrl, self.location))

const asRelativeUrl = (url) => url.slice(self.location.origin.length)

const resolveResources = (resources) => {
  const resourcesResolved = {}
  Object.keys(resources).forEach((url) => {
    const info = resources[url]
    const urlResolved = asAbsoluteUrl(url)
    if (info.versionedUrl) {
      info.versionedUrl = asAbsoluteUrl(info.versionedUrl)
    }
    resourcesResolved[urlResolved] = info
  })
  return resourcesResolved
}

const fetchAndPutInCache = async (request, cache) => {
  const response = await self.fetch(request)
  if (response.status === 200) {
    const responseToCache = await asResponseToPutInCache(response)
    await cache.put(request, responseToCache)
  }
  return response
}

const asResponseToPutInCache = async (response) => {
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
