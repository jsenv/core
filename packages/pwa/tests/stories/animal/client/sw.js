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
  }
  if (data.action === "reject_install") {
    _rejectInstallPromise(data.value)
  }
})
self.addEventListener("install", (installEvent) => {
  if (intrumentInstall) {
    installEvent.waitUntil(installPromise)
  }
})

let animalImageUrl = "cat.svg"
self.addEventListener("message", async ({ data }) => {
  if (data.action === "set_animal_image_url") {
    animalImageUrl = data.value
  }
})
self.addEventListener("fetch", (fetchEvent) => {
  if (fetchEvent.request.url.includes("cat.svg")) {
    fetchEvent.respondWith(
      fetch(redirectRequest(fetchEvent.request, animalImageUrl)),
    )
  }
})
const redirectRequest = async (request, url) => {
  const { mode } = request
  // see https://github.com/GoogleChrome/workbox/issues/1796
  if (mode !== "navigate") {
    return new Request(url, request)
  }

  const requestClone = request.clone()
  const { body, credentials, headers, integrity, referrer, referrerPolicy } =
    requestClone
  const bodyPromise = body ? Promise.resolve(body) : requestClone.blob()
  const bodyValue = await bodyPromise

  const requestMutated = new Request(url, {
    body: bodyValue,
    credentials,
    headers,
    integrity,
    referrer,
    referrerPolicy,
    mode: "same-origin",
    redirect: "manual",
  })
  return requestMutated
}
