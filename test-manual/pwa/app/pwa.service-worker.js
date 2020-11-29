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

// attention: il ne faudra pas mettre en cache tout
// ou plus exactement pour index.html il faudrait une approche
// network-first-with-fallback-to-cache
// https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker
/*
hum je sais pas trop, le html on en a besoin pour le offline
donc on veut l'avoir direct

mais s'il a été modifié on veut le dire au user
sauf que si seulement le html est modifié, la liste d'url ne contient pas le html
et surtout pas le hash du fichier html donc pour le browser rien n'a changé

pour fixer ça il faudrait mettre le hash du fichier html
dans pwa.manifest.js comme ça le fichier est changé
meme si le fichier html ne l'est pas
*/
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
    cacheKeys.map((cacheKey) => {
      if (cacheKey === cacheName) {
        return null
      }
      console.log(`[Service Worker] Delete cache named: ${cacheKey}`)
      return caches.delete(cacheKey)
    }),
  )
}

const deleteOtherUrls = async () => {
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
