/**
 *
 *
 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *

 ok pour connecter ceci a mille-sabords
 on veut que cachename soit update lorsque urlsToCache
 change en gros
 a-t-on besoin que urlToCache soit en dur ici?
 non pas vraiment on pourrait le fetch depuis dist/build.manifest.json

 ptet faire ca aussi: https://stackoverflow.com/a/64880568 pendant l'install
 */

/* globals self */
self.importScripts("./pwa.manifest.js")

const urlsToCache = self.urlsToCache
const cacheName = self.cacheName
const caches = self.caches

const install = async () => {
  console.info("[Service Worker] Install start")
  try {
    const cache = await caches.open(cacheName)

    const total = urlsToCache.length
    let installed = 0

    await Promise.all(
      urlsToCache.map(async (url) => {
        let controller
        try {
          controller = new AbortController()
          const { signal } = controller
          // the cache option set to reload will force the browser to
          // request any of these resources via the network,
          // which avoids caching older files again
          const request = new Request(url, { cache: "reload" })
          const response = await fetch(request, { signal })

          if (response && response.status === 200) {
            await cache.put(request, response.clone())
            installed += 1
          } else {
            console.info(`unable to fetch ${url} (${response.status})`)
          }
        } catch (e) {
          console.info(`Error while fetching ${url}: ${e.stack}`)
          // abort request in any case
          controller.abort()
        }
      }),
    )

    if (installed === total) {
      console.info(`[Service Worker] Install done (${total} urls added in cache)`)
    } else {
      console.info(`[Service Worker] Install done (${installed}/${total} urls added in cache)`)
    }
  } catch (error) {
    console.error(`[Service Worker] Install error: ${error.stack}`)
  }
}

const handleRequest = async (request) => {
  console.log(`[Service Worker] Received fetch event for ${request.url}`)
  try {
    const responseFromCache = await caches.match(request)
    if (responseFromCache) {
      console.log(`[Service Worker] Return response in cache for ${request.url}`)
      return responseFromCache
    }
  } catch (error) {
    console.warn(
      `[Service Worker] Error while trying to serve response for ${request.url} from cache`,
      error.stack,
    )
    return fetch(request)
  }

  console.log(`[Service Worker] No cache for ${request.url}, fetching it`)
  const [response, cache] = await Promise.all([fetch(request), caches.open(cacheName)])
  cache.put(request, response.clone())
  console.log(`[Service Worker] Caching new resource: ${request.url}`)
  return response
}

const activate = async () => {
  // const cache = await caches.open(cacheName)
  // const cacheRequests = await cache.keys()
  // await Promise.all(
  //   cacheRequests.map(async (cacheRequest) => {
  //     if (!urlsToCache.includes(cacheRequest.url)) {
  //       console.log(`[Service Worker] Delete resource: ${cacheRequest.url}`)
  //       await cache.delete(cacheRequest)
  //     }
  //   }),
  // )
  const cacheKeys = await caches.keys()
  await Promise.all(
    cacheKeys.map((cacheKey) => {
      if (cacheKey === cacheName) {
        return null
      }
      console.log(`[Service Worker] Delete cache named: ${cacheKey}`)
      return caches.delete(cacheKey)
    }),
  )
}

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(install(installEvent))
})

self.addEventListener("fetch", (fetchEvent) => {
  const { request } = fetchEvent
  if (request.method === "GET" || request.method === "HEAD") {
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
