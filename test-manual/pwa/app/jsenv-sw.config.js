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
  shouldReloadOnInstall(response, request)

  It is a function that will be used to decide if cache must be ignored
  when service worker installs. When returning true service worker
  re-fetch even if there is cache for that request, otherwise cache is reused.
  It is called on every self.urlsToCacheOnInstall.
  shouldReloadOnInstall is not called at all if server is sending cache-control
  with a max-age > 0 for that request. Meaning the cache is reused in that case.

  The implementation below tells to reuse cache for every url listed in
  self.urlsToCacheOnInstall.
*/
self.shouldReloadOnInstall = () => false

/*
  Whenever you change something in this file, such as self.cacheName
  or self.urlsToCacheOnInstall, browser reinstalls the service worker.
  When service worker activates, it is responsible to clean the cache
  used by the previous service worker version.

  This logic must be implemented using self.shouldCleanOnActivate and
  self.shouldCleanOtherCacheOnActivate functions below.
*/

/*
  shouldCleanOnActivate(response, request)

  It is a function that will be used to decide if a cached response must be deleted
  when service worker activates.

  The implementation below tells to delete cache for any request not listed
  in self.urlsToCacheOnInstall. It means that if an url was listed in the previous worker
  but is not anymore it will be deleted. It also means that if a request returns true for
  self.shouldCacheRequest and is not listed in self.urlsToCacheOnInstall, that request
  cache will be deleted every time service worker is activated after an update.
*/
self.shouldCleanOnActivate = (response, request) => !self.urlsToCacheOnInstall.includes(request.url)

/*
  shouldCleanOtherCacheOnActivate(cacheKey)

  It is a function that will be used to decide if an existing cache must be deleted
  when the service worker activates.

  The implementation below tells to delete cache only if it starts by "pwa-cache"
  to ensure we delete only cache the we have created. It means that if you want to
  update self.cacheName you should update pwa-cache-1 to pwa-cache-2 and so on. Or update
  shouldCleanOtherCacheOnActivate to match your custom logic.
*/
self.shouldCleanOtherCacheOnActivate = (cacheKey) => cacheKey.startsWith("pwa-cache")

self.logsEnabled = true
