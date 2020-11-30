/* globals self */

self.importScripts("./jsenv-sw.build_urls.js")

self.cacheName = `pwa-cache-1`

/**
 * Service worker will try to put all self.urlsToCacheOnInstall into browser cache
 * when it is installed (installation happens once).
 * Putting an url in that list means it is mandatory for the website to work offline
 * and that it will be cached as long as service worker is alive.
 */
self.urlsToCacheOnInstall = [...self.jsenvBuildUrls, "pwa.style.css"]

/*
  Decides if the request must be cached or not.

  When returning true, the response for that request will be stored into cache
*/
self.shouldCacheRequest = (request) => {
  if (!self.urlsToCacheOnInstall.includes(request.url)) return false
  return request.method === "GET" || request.method === "HEAD"
}

/*
  Whenever you change something in this file, such as self.cacheName
  or self.urlsToCacheOnInstall, browser reinstalls the service worker.
  When service worker activates, it is responsible to clean the cache
  used by the previous service worker version.

  shouldDeleteCacheOnActivation is a funciton that will be used to decide
  if an existing cache must be deleted when the service worker activates.
  The implementation below tells to delete cache only if it starts by "pwa-cache"
  to ensure we delete only cache the we have created.
  It means that if you want to update self.cacheName you should
  update pwa-cache-1 to pwa-cache-2 and so on. Or update
  deleteCacheOnActivationPredicate to match your custom logic.

  shouldDeleteRequestCacheOnActivation is a function that will be used to decide
  if a cached request must be deleted or not when service worker activates.
  The implementation below tells to delete request if it's not
  in self.urlsToCacheOnInstall.
  It means if you depend on an url that is not listed by self.urlsToCacheOnInstall
  it will be re-fetched (and put into cache) every time your update the service worker.
*/
self.shouldDeleteCacheOnActivation = (cacheKey) => cacheKey.startsWith("pwa-cache")
self.shouldDeleteRequestCacheOnActivation = (request) =>
  !self.urlsToCacheOnInstall.includes(request.url)

self.logsEnabled = true
