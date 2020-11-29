/**
 *
 *
 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://github.com/deanhume/pwa-update-available
 * https://deanhume.com/displaying-a-new-version-available-progressive-web-app/
 * https://raw.githubusercontent.com/GoogleChromeLabs/sw-precache/master/service-worker.tmpl
 *
 */

/* globals self */

// cacheName et urls to cache on voudra ptet générer ça automatiquement avec
// la fonction buildProject de jsenv

const urlsToCache = [
  "pwa.style.css",
  // comment this line below to to fake update of service worker
  // "pwa.favicon.png",
]
const cacheName = `pwa-cache-${urlsToCache.length}`

let handleFetchEvent = () => null

let handleActivateEvent = () => null

const install = async () => {
  console.log("[Service Worker] Install")

  const cache = await self.caches.open(cacheName)
  console.log("[Service Worker] Caching app files", urlsToCache)
  await cache.addAll(urlsToCache)

  handleFetchEvent = async (fetchEvent) => {
    const { request } = fetchEvent
    console.log(`[Service Worker] Received fetch event for ${request.url}`)
    try {
      const responseFromCache = await self.caches.match(request)

      if (responseFromCache) {
        console.log(`[Service Worker] Return response in cache for ${request.url}`)
        return responseFromCache
      }

      console.log(`[Service Worker] No cache for ${request.url}, fetching it`)
      const response = await fetch(request)
      cache.put(request, response.clone())
      console.log(`[Service Worker] Caching new resource: ${request.url}`)
      return response
    } catch (error) {
      console.warn(
        `[Service Worker] Error while trying to serve response for ${request.url} from cache`,
        error.stack,
      )
      return fetch(request)
    }
  }

  handleActivateEvent = async () => {
    const cacheRequests = await cache.keys()
    await Promise.all(
      cacheRequests.map(async (cacheRequest) => {
        if (!urlsToCache.includes(cacheRequest.url)) {
          console.log(`[Service Worker] Delete  resource: ${cacheRequest.url}`)
          await cache.delete(cacheRequest)
        }
      }),
    )
  }
}

self.addEventListener("install", (installEvent) => {
  installEvent.waitUntil(install(installEvent))
})

self.addEventListener("fetch", (fetchEvent) => {
  if (!urlsToCache.includes(fetchEvent.request.url)) {
    return
  }
  const responsePromise = handleFetchEvent(fetchEvent)
  if (responsePromise) {
    fetchEvent.respondWith(responsePromise)
  }
})

self.addEventListener("activate", (activateEvent) => {
  const activatePromise = handleActivateEvent(activateEvent)
  if (activatePromise) {
    activateEvent.waitUntil(activatePromise)
  }
})

self.addEventListener("message", function (messageEvent) {
  if (messageEvent.data.action === "skipWaiting") {
    self.skipWaiting()
  }
})
