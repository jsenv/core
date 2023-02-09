/* eslint-env serviceworker */

const cachePrefix = "jsenv"
const cacheName = (() => {
  const base = 36
  const blockSize = 4
  const discreteValues = Math.pow(base, blockSize)
  const pad = (number, size) => {
    var s = `000000000${number}`
    return s.substr(s.length - size)
  }
  const getRandomValue = (() => {
    const { crypto } = self
    if (crypto) {
      const lim = Math.pow(2, 32) - 1
      return () => {
        return Math.abs(crypto.getRandomValues(new Uint32Array(1))[0] / lim)
      }
    }
    return Math.random
  })()
  const randomBlock = () => {
    return pad(
      ((getRandomValue() * discreteValues) << 0).toString(base),
      blockSize,
    )
  }

  const timestamp = new Date().getTime().toString(base)
  const random = `${randomBlock()}${randomBlock()}`
  return `${cachePrefix}${timestamp}${random}`
})()

self.version = 2
self.resources = [
  {
    url: "animal.svg",
    versionedUrl: "animal.svg?v=cat",
  },
]
self.resources.forEach((resource) => {
  resource.url = new URL(resource.url, self.location).href
  if (resource.versionedUrl) {
    resource.versionedUrl = new URL(resource.versionedUrl, self.location).href
  }
})
self.addEventListener("message", ({ data, ports }) => {
  if (data.action === "inspect") {
    ports.postMessage({
      version: self.version,
      resources: self.resources,
    })
  }
})

self.addEventListener("message", async ({ data }) => {
  if (data.action === "skipWaiting") {
    self.skipWaiting()
  }
})
let instrumentInstall = false
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
  const promiseToWait = instrumentInstall
    ? Promise.all([installPromise, handleInstallEvent(installEvent)])
    : handleInstallEvent(installEvent)
  installEvent.waitUntil(promiseToWait)
})
const handleInstallEvent = async () => {
  const cache = await self.caches.open(cacheName)
  for (const resource of self.resources) {
    const url = resource.versionedUrl || resource.url
    const request = new Request(url)
    const response = await fetch(request)
    if (response.status === 200) {
      console.debug(
        `fresh response found for ${request.url}, put it in cache and respond with it`,
      )
      const responseToCache = await asResponseToPutInCache(response)
      await cache.put(request, responseToCache)
    } else {
      console.warn(
        `cannot put ${request.url} in cache due to response status (${response.status})`,
      )
    }
  }
}
const asResponseToPutInCache = async (response) => {
  const responseClone = response.clone()
  if (!response.redirected) {
    return responseClone
  }
  // When passed a redirected response, this will create a new, "clean" response
  // that can be used to respond to a navigation request.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=669363&desc=2#c1

  // Not all browsers support the Response.body stream, so fall back to reading
  // the entire body into memory as a blob.
  const bodyPromise =
    "body" in responseClone
      ? Promise.resolve(responseClone.body)
      : responseClone.blob()
  const body = await bodyPromise
  // new Response() is happy when passed either a stream or a Blob.
  return new Response(body, {
    headers: responseClone.headers,
    status: responseClone.status,
    statusText: responseClone.statusText,
  })
}

let claimPromise
self.addEventListener("message", async ({ data }) => {
  if (data.action === "claim") {
    claimPromise = self.clients.claim()
  }
})

self.addEventListener("activate", (activateEvent) => {
  const promiseToWait = claimPromise
    ? Promise.all([claimPromise, deleteOtherCaches()])
    : claimPromise
  activateEvent.waitUntil(promiseToWait)
})
const deleteOtherCaches = async () => {
  const cacheKeys = await self.caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== cacheName && cacheKey.startsWith(cachePrefix)) {
        console.info(`delete cache ${cacheKey}`)
        await self.caches.delete(cacheKey)
      }
    }),
  )
}

self.addEventListener("fetch", async (fetchEvent) => {
  const request = fetchEvent.request
  if (request.mode === "navigate") {
    return
  }
  fetchEvent.waitUntil(handleFetchEvent(fetchEvent))
})
const handleFetchEvent = async (fetchEvent) => {
  const request = fetchEvent.request
  const responseFromCache = await self.caches.match(request)
  if (responseFromCache) {
    console.debug(`respond with response from cache for ${request.url}`)
    fetchEvent.respondWith(responseFromCache)
    return
  }
  try {
    const responseFromCache = await self.caches.match(request)
    if (responseFromCache) {
      console.debug(`respond with response from cache for ${request.url}`)
      fetchEvent.respondWith(responseFromCache)
      return
    }
  } catch (error) {
    console.warn(
      `error while trying to use cache for ${request.url}`,
      error.stack,
    )
    return
  }
}
