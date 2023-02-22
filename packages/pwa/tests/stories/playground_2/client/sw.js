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
  return `${cachePrefix}_${timestamp}${random}`
})()

let logLevel = "debug"
let logBackgroundColor = "grey"
let logColor = "white"
const logger = {
  setOptions: (options) => {
    logLevel = options.logLevel || logLevel
    logBackgroundColor = options.logBackgroundColor || logBackgroundColor
    logColor = options.logColor || logColor
  },
  debug: (...args) => {
    if (logLevel === "debug") {
      console.info(...injectLogStyles(args))
    }
  },
  info: (...args) => {
    if (logLevel === "debug" || logLevel === "info") {
      console.info(...injectLogStyles(args))
    }
  },
  warn: (...args) => {
    if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
      console.info(...injectLogStyles(args))
    }
  },
  error: (...args) => {
    if (
      logLevel === "debug" ||
      logLevel === "info" ||
      logLevel === "warn" ||
      logLevel === "error"
    ) {
      console.info(...injectLogStyles(args))
    }
  },
  debugGroupCollapsed: (...args) => {
    if (logLevel === "debug") {
      console.group(...injectLogStyles(args))
    }
  },

  groupEnd: () => console.groupEnd(),
}

const injectLogStyles = (args) => {
  return [
    `%cjsenv %csw`,
    `background: orange; color: white; padding: 1px 3px; margin: 0 1px`,
    `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
    ...args,
  ]
}

self.version = "v=dog"
self.resources = {
  "main.html": {
    version: "fixed",
  },
  "animal.svg": {
    versionedUrl: "animal.svg?v=dog",
    version: "v=dog",
  },
}
var r = {}
Object.keys(self.resources).forEach((url) => {
  const info = self.resources[url]
  url = new URL(url, self.location).href
  if (info.versionedUrl) {
    info.versionedUrl = new URL(info.versionedUrl, self.location).href
  }
  r[url] = info
})
self.resources = r
self.addEventListener("message", ({ data, ports }) => {
  if (data.action === "inspect") {
    ports[0].postMessage({
      status: "resolved",
      payload: {
        version: self.version,
        resources: self.resources,
        installInstrumentation,
        activateInstrumentation,
      },
    })
  }
})

self.addEventListener("message", async ({ data }) => {
  if (data.action === "skipWaiting") {
    self.skipWaiting()
  }
})
let installInstrumentation = true
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
  const promiseToWait = Promise.all([
    ...(installInstrumentation ? [installPromise] : []),
    handleInstallEvent(installEvent),
  ])
  installEvent.waitUntil(promiseToWait)
})
const handleInstallEvent = async () => {
  const cache = await self.caches.open(cacheName)
  for (const url of Object.keys(self.resources)) {
    const resource = self.resources[url]
    const urlToFetch = resource.versionedUrl || url
    const request = resource.versionedUrl
      ? new Request(urlToFetch)
      : // A non versioned url must ignore navigator cache
        // otherwise we might (99% chances) hit previous worker cache
        // and miss the new version
        new Request(urlToFetch, { cache: "reload" })
    const response = await fetch(request)
    if (response.status === 200) {
      logger.debug(
        `put "${asUrlRelativeToDocument(request.url)}" in cache during install`,
      )
      const responseToCache = await asResponseToPutInCache(response)
      await cache.put(request, responseToCache)
    } else {
      logger.warn(
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

let activateInstrumentation = true
let _resolveActivatePromise
let _rejectActivatePromise
const activatePromise = new Promise((resolve, reject) => {
  _resolveActivatePromise = resolve
  _rejectActivatePromise = reject
})
self.addEventListener("message", ({ data }) => {
  if (data.action === "resolve_activate") {
    _resolveActivatePromise(data.value)
  }
  if (data.action === "reject_activate") {
    _rejectActivatePromise(data.value)
  }
})
self.addEventListener("activate", (activateEvent) => {
  const promiseToWait = Promise.all([
    ...(claimPromise ? [claimPromise] : []),
    ...(activateInstrumentation ? [activatePromise] : []),
    deleteOldCaches(),
  ])
  activateEvent.waitUntil(promiseToWait)
})
const deleteOldCaches = async () => {
  const cacheKeys = await self.caches.keys()
  await Promise.all(
    cacheKeys.map(async (cacheKey) => {
      if (cacheKey !== cacheName && cacheKey.startsWith(`${cachePrefix}_`)) {
        logger.info(`delete cache ${cacheKey}`)
        await self.caches.delete(cacheKey)
      }
    }),
  )
}

self.addEventListener("fetch", async (fetchEvent) => {
  const request = fetchEvent.request
  if (request.mode !== "navigate") {
    fetchEvent.respondWith(handleFetchEvent(fetchEvent))
  }
})
const handleFetchEvent = async (fetchEvent) => {
  const request = fetchEvent.request
  try {
    const cache = await self.caches.open(cacheName)
    const responseFromCache = await cache.match(request)
    if (responseFromCache) {
      logger.debug(`from cache -> "${asUrlRelativeToDocument(request.url)}"`)
      return responseFromCache
    }
    logger.debug(`from network -> "${asUrlRelativeToDocument(request.url)}"`)
    return self.fetch(request)
  } catch (error) {
    logger.warn(
      `error while trying to use ${cacheName} cache on "${asUrlRelativeToDocument(
        request.url,
      )}"`,
      error.stack,
    )
    return self.fetch(request)
  }
}

const asUrlRelativeToDocument = (url) => {
  return url.slice(self.location.origin.length)
}

// const cloneNavRequest = async (request) => {
//   const requestClone = request.clone()
//   const {
//     method,
//     body,
//     credentials,
//     headers,
//     integrity,
//     referrer,
//     referrerPolicy,
//   } = requestClone
//   if (method === "GET" || method === "HEAD") {
//     return new Request(request.url, {
//       credentials,
//       headers,
//       integrity,
//       referrer,
//       referrerPolicy,
//       mode: "same-origin",
//       redirect: "manual",
//     })
//   }
//   const bodyPromise = body ? Promise.resolve(body) : requestClone.blob()
//   const bodyValue = await bodyPromise
//   return new Request(request.url, {
//     body: bodyValue,
//     credentials,
//     headers,
//     integrity,
//     referrer,
//     referrerPolicy,
//     mode: "same-origin",
//     redirect: "manual",
//   })
// }
