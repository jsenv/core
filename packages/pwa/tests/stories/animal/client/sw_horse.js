/* eslint-env serviceworker */

self.addEventListener("message", async ({ data }) => {
  if (data.action === "skipWaiting") {
    self.skipWaiting()
  }
})

let intrumentInstall = false
let _resolveInstallPromise
let _rejectInstallPromise
const installPromise = new Promise((resolve, reject) => {
  _resolveInstallPromise = resolve
  _rejectInstallPromise = reject
})
self.addEventListener("message", ({ data }) => {
  if (data.action === "resolve_install") {
    _resolveInstallPromise(data.value)
    self.skipWaiting()
  }
  if (data.action === "reject_install") {
    _rejectInstallPromise(data.value)
  }
})
self.addEventListener("install", (installEvent) => {
  if (intrumentInstall) {
    installEvent.waitUntil(installPromise)
  } else {
    self.skipWaiting()
  }
})

let animalImageUrl = "horse.svg"
self.addEventListener("message", async ({ data }) => {
  if (data.action === "set_animal_image_url") {
    animalImageUrl = data.value
  }
})
self.addEventListener("fetch", (fetchEvent) => {
  const request = fetchEvent.request
  if (request.mode === "navigate") {
    return
  }
  if (!request.url.includes("cat.svg")) {
    fetchEvent.respondWith(fetch(request))
    return
  }
  const requestRedirected = new Request(
    new URL(animalImageUrl, self.location),
    request,
  )
  const responsePromise = fetch(requestRedirected)
  fetchEvent.respondWith(responsePromise)
})
