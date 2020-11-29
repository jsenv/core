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

const urlsToCache = ["pwa.style.css"]
const cacheName = `pwa-cache-${urlsToCache.length}`
const caches = self.caches

// il y a certaines urls a considérer avant qu'un
// service worker puisse dire "hey c'est bon je suis ready"
// c'est le concept de coque minimale pour que ça marche dont
// parle la doc
// ensuite, on peut vouloir pre-cache certaines urls
// (en vérité toutes les urls du site)
// pour qu'il fonctionne hors-ligne
// et ensuite si le site a besoin de plus d'urls c'est ok
// le truc qui pre-cache les urls c'est pas super important je dirais
// ou alors il faut considérer que l'ensemble du site doit etre la
// pour simplifier, au lieu de séparer en deux

const install = async () => {
  console.log("[Service Worker] Install")
  const cache = await caches.open(cacheName)
  console.log("[Service Worker] Caching app files", urlsToCache)
  await cache.addAll(urlsToCache)
}

const handleRequest = async (request) => {
  const cache = await caches.open(cacheName)
  console.log(`[Service Worker] Received fetch event for ${request.url}`)
  try {
    const responseFromCache = await caches.match(request)

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

const activate = async () => {
  const cache = await caches.open(cacheName)
  const cacheRequests = await cache.keys()
  await Promise.all(
    cacheRequests.map(async (cacheRequest) => {
      if (!urlsToCache.includes(cacheRequest.url)) {
        console.log(`[Service Worker] Delete resource: ${cacheRequest.url}`)
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
