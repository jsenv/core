/**
 * https://stackoverflow.com/questions/33262385/service-worker-force-update-of-new-assets/64880568#64880568
 * https://gomakethings.com/how-to-set-an-expiration-date-for-items-in-a-service-worker-cache/

 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *
*/

/* globals self, config */
self.importScripts("./jsenv-sw.config.js")

const createLogMethod = (method) =>
  config.logsEnabled ? (...args) => console[method](...prefixArgs(...args)) : () => {}
const info = createLogMethod("info")
// const debug = createLogMethod("debug")
const warn = createLogMethod("warn")
// const error = createLogMethod("error")

const prefixArgs = (...args) => {
  return [
    `%csw`,
    `background: ${config.logsBackgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ]
}

const caches = self.caches

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

let cache
const getCache = async () => {
  if (cache) return cache
  cache = await caches.open(config.cacheName)
  return cache
}

const fetchAndCache = async (request, { oncache } = {}) => {
  const [response, cache] = await Promise.all([fetchUsingNetwork(request), getCache()])

  if (response.status === 200) {
    info(`fresh response found for ${request.url}, put it in cache and respond with it`)

    const cacheWrittenPromise = cache.put(request, response.clone())
    if (oncache) {
      await cacheWrittenPromise
      oncache()
    }

    return response
  }
  info(`cannot put ${request.url} in cache due to response status (${response.status})`)
  return response
}

const install = async () => {
  info("install start")
  try {
    const total = config.urlsToCacheOnInstall.length
    let installed = 0

    await Promise.all(
      config.urlsToCacheOnInstall.map(async (url) => {
        try {
          const request = new Request(url)
          const responseInCache = await caches.match(request)

          if (responseInCache) {
            const shouldReload = responseCacheIsValid(responseInCache)
              ? false
              : config.shouldReloadOnInstall(responseInCache, request)
            if (shouldReload) {
              info(`${request.url} in cache but should be reloaded`)
              const requestByPassingCache = new Request(url, { cache: "reload" })
              await fetchAndCache(requestByPassingCache, {
                oncache: () => {
                  installed += 1
                },
              })
            } else {
              info(`${request.url} already in cache`)
              installed += 1
            }
          } else {
            await fetchAndCache(request, {
              oncache: () => {
                installed += 1
              },
            })
          }
        } catch (e) {
          info(`cannot put ${url} in cache due to error while fetching: ${e.stack}`)
        }
      }),
    )
    if (installed === total) {
      info(`install done (${total} urls added in cache)`)
    } else {
      info(`install done (${installed}/${total} urls added in cache)`)
    }
  } catch (error) {
    error(`install error: ${error.stack}`)
  }
}

const handleRequest = async (request) => {
  info(`received fetch event for ${request.url}`)
  try {
    const responseFromCache = await caches.match(request)
    if (responseFromCache) {
      info(`respond with response from cache for ${request.url}`)
      return responseFromCache
    }
  } catch (error) {
    warn(`error while trying to use cache for ${request.url}`, error.stack)
    return fetch(request)
  }

  info(`no cache for ${request.url}, fetching it`)
  return fetchAndCache(request)
}

const activate = async () => {
  info("activate start")
  await Promise.all([deleteOtherUrls(), deleteOtherCaches()])
  info("activate done")
}

const deleteOtherUrls = async () => {
  const cache = await caches.open(config.cacheName)
  const requestsInCache = await cache.keys()
  await Promise.all(
    requestsInCache.map(async (requestInCache) => {
      const responseInCache = await cache.match(requestInCache)
      if (config.shouldCleanOnActivate(responseInCache, requestInCache)) {
        info(`delete ${requestInCache.url}`)
        await cache.delete(requestInCache)
      }
    }),
  )
}

const deleteOtherCaches = async () => {
  const cacheKeys = await caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== config.cacheName && config.shouldCleanOtherCacheOnActivate(cacheKey)) {
        info(`delete cache ${cacheKey}`)
        await caches.delete(cacheKey)
      }
    }),
  )
}

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(install(installEvent))
})

self.addEventListener("fetch", (fetchEvent) => {
  const { request } = fetchEvent
  if (config.shouldCacheRequest(request)) {
    const responsePromise = handleRequest(request)
    if (responsePromise) {
      fetchEvent.respondWith(responsePromise)
    }
  }
})

self.addEventListener("activate", (activateEvent) => {
  const activatePromise = activate(activateEvent)
  if (activatePromise) {
    activateEvent.waitUntil(activatePromise)
  }
})

self.addEventListener("message", async (messageEvent) => {
  const { data } = messageEvent
  if (typeof data !== "object") return
  const { action } = data
  const actionFn = actions[action]
  if (!actionFn) return

  const { args = [] } = data

  let status
  let value
  try {
    const actionFnReturnValue = await actionFn(...args)
    status = "resolved"
    value = actionFnReturnValue
  } catch (e) {
    status = "rejected"
    value = e
  }

  messageEvent.ports[0].postMessage({ status, value })
})

const actions = {
  skipWaiting: () => {
    self.skipWaiting()
  },
  ping: () => "pong",
  refreshCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const response = await fetchAndCache(new Request(url, { cache: "reload" }))
    return response.status
  },
  addCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const response = await fetchAndCache(url)
    return response.status
  },
  removeCacheKey: async (url) => {
    url = String(new URL(url, self.location))
    const cache = await caches.open(config.cacheName)
    const deleted = await cache.delete(url)
    return deleted
  },
}

const responseCacheIsValid = (responseInCache) => {
  const cacheControlResponseHeader = responseInCache.headers.get("cache-control")
  const maxAge = parseMaxAge(cacheControlResponseHeader)
  return maxAge && maxAge > 0
}

// https://github.com/tusbar/cache-control
const parseMaxAge = (cacheControlHeader) => {
  if (!cacheControlHeader || cacheControlHeader.length === 0) return null

  const HEADER_REGEXP = /([a-zA-Z][a-zA-Z_-]*)\s*(?:=(?:"([^"]*)"|([^ \t",;]*)))?/g
  const matches = cacheControlHeader.match(HEADER_REGEXP) || []

  const values = {}
  Array.from(matches).forEach((match) => {
    const tokens = match.split("=", 2)

    const [key] = tokens
    let value = null

    if (tokens.length > 1) {
      value = tokens[1].trim()
    }

    values[key.toLowerCase()] = value
  })

  return parseDuration(values["max-age"])
}

const parseDuration = (value) => {
  if (!value) {
    return null
  }

  const duration = Number.parseInt(value, 10)

  if (!Number.isFinite(duration) || duration < 0) {
    return null
  }

  return duration
}
