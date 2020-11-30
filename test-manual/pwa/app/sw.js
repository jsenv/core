/**
 * https://stackoverflow.com/questions/33262385/service-worker-force-update-of-new-assets/64880568#64880568
 * https://gomakethings.com/how-to-set-an-expiration-date-for-items-in-a-service-worker-cache/

 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *
*/

/* globals self */
self.importScripts("./sw.config.js")

const cacheName = self.cacheName
const urlsToCacheOnInstall = self.urlsToCacheOnInstall
const logsEnabled = self.logsEnabled

const createLogMethod = (method) =>
  logsEnabled ? (...args) => console[method](...prefixArgs(...args)) : () => {}
const info = createLogMethod("info")
// const debug = createLogMethod("debug")
const warn = createLogMethod("warn")
// const error = createLogMethod("error")

const backgroundColor = "#ffdc00" // nice yellow
const prefixArgs = (...args) => {
  return [
    `%csw`,
    `background: ${backgroundColor}; color: black; padding: 1px 3px; margin: 0 1px`,
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

const install = async () => {
  info("install start")
  try {
    const cache = await caches.open(cacheName)

    const total = urlsToCacheOnInstall.length
    let installed = 0
    await Promise.all(
      urlsToCacheOnInstall.map(async (url) => {
        try {
          // the cache option set to reload will force the browser to
          // request any of these resources via the network,
          // which avoids caching older files again
          const request = new Request(url, { cache: "reload" })
          const response = await fetchUsingNetwork(request)

          if (response && response.status === 200) {
            info(`put ${url} in cache`)
            await cache.put(request, response.clone())
            installed += 1
          } else {
            info(`cannot put ${url} in cache due to response status (${response.status})`)
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
  const [response, cache] = await Promise.all([fetchUsingNetwork(request), caches.open(cacheName)])
  if (response.status === 200) {
    info(`fresh response found for ${request.url}, put it in cache and respond with it`)
    cache.put(request, response.clone())
    return response
  }
  info(`cannot put ${request.url} in cache due to response status (${response.status})`)
  return response
}

const activate = async () => {
  await Promise.all([deleteOtherCaches(), deleteOtherUrls()])
}

// idéalement on ne supprimerais pas TOUT les autres caches
// on surppimerais que ce qui ressemble a ce qu'on connait
// (un prefix qui permettrais de se rassurer qu'on ne supprime pas quelque chose
// qu'on ne controle pas comme une lib externe qui utilise aussi le cache)
// comme par exemple: https://github.com/GoogleChromeLabs/sw-precache/blob/b202ca04fe87555d7fe9ca338f87fbcf76812c39/lib/functions.js#L68
// et ensuite il ne supprime que ce qui ressemble a quelque chose qu'il a lui meme mis en cache
// ah non il font pas ça pour ça mais on pourrait faire ça
const deleteOtherCaches = async () => {
  const cacheKeys = await caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== self.cacheName && self.shouldDeleteCacheOnActivation(cacheKey)) {
        info(`delete cache ${cacheKey}`)
        await caches.delete(cacheKey)
      }
    }),
  )
}

const deleteOtherUrls = async () => {
  const cache = await caches.open(cacheName)
  const cacheRequests = await cache.keys()
  await Promise.all(
    cacheRequests.map(async (cacheRequest) => {
      if (self.shouldDeleteRequestCacheOnActivation(cacheRequest)) {
        info(`delete ${cacheRequest.url}`)
        await cache.delete(cacheRequest)
      }
    }),
  )
}

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(install(installEvent))
})

self.addEventListener("fetch", (fetchEvent) => {
  const { request } = fetchEvent
  if (self.shouldCacheRequest(request)) {
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

self.addEventListener("message", function (messageEvent) {
  if (messageEvent.data.action === "skipWaiting") {
    self.skipWaiting()
  }
  if (messageEvent.data === "ping") {
    messageEvent.ports[0].postMessage("pong")
  }
})
