/*
 * AI reading this file: read ../docs/AI_INSTRUCTIONS.md for context on
 * using @jsenv/service-worker as intended; ../docs/usage.md shows complete
 * usage examples.
 *
 * This is a classic worker script (not a module): a service worker file loads
 * it with self.importScripts() then calls self.__sw__.init(). It caches the
 * given resources during "install", serves them from cache in "fetch", and
 * answers the { action } message protocol used by @jsenv/pwa
 * ("inspect", "skipWaiting", "claim", "postReloadAfterUpdateToClients", ...).
 *
 * Background reading:
 * https://web.dev/service-worker-caching-and-http-caching/
 * https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle
 * https://stackoverflow.com/questions/33262385/service-worker-force-update-of-new-assets/64880568#64880568
 *
 * Do not use relative self.importScripts in there because
 * they are resolved against self.location. It means
 * ./file.js would be resolved against the project root
 */

self.__sw__ = {};

const sw = self.__sw__;
// define self.__sw__.registerActions()
{
  const actions = {};
  self.addEventListener("message", async (messageEvent) => {
    const { data, ports } = messageEvent;
    if (typeof data !== "object") {
      return;
    }
    const { action } = data;
    const actionFn = actions[action];
    if (!actionFn) {
      return;
    }
    const { payload } = data;
    let actionResultStatus;
    let actionResultValue;
    try {
      const actionFnReturnValue = await actionFn(payload);
      actionResultStatus = "resolved";
      actionResultValue = actionFnReturnValue;
    } catch (e) {
      actionResultStatus = "rejected";
      actionResultValue = e;
    }
    ports[0].postMessage({ actionResultStatus, actionResultValue });
  });
  sw.registerActions = (value) => {
    Object.assign(actions, value);
  };
}

// define self.__sw__.init()
{
  /**
   * Initializes the service worker: caches `resources` during "install",
   * serves them from cache in "fetch", deletes previous caches during
   * "activate" and answers the `{ action }` message protocol.
   *
   * @param {Object} [options]
   * @param {string} [options.name="jsenv"] Prefix identifying the caches
   *   created by this service worker, so a new version can delete the caches
   *   of the previous one during "activate".
   * @param {string} [options.version="1"] Version of the service worker
   *   implementation. Bump it when the new script must NOT be hot-updated by
   *   @jsenv/pwa (a version change forces a full reload after update).
   * @param {Object} [options.meta={}] Extra values returned to the page by the
   *   "inspect" action (merged with name, version and resources).
   * @param {string} [options.logLevel="warn"] "debug" | "info" | "warn" | "error"
   * @param {string} [options.logBackgroundColor]
   * @param {string} [options.logColor]
   * @param {Object} [options.resources={ "/": {} }] Urls to put into the
   *   browser cache during "install", and to serve from cache in "fetch".
   *   Keys are urls (resolved against the service worker location); values are
   *   `{}` for unversioned urls (refetched with cache: "reload" on every
   *   install) or `{ version, versionedUrl }` for build-versioned urls.
   *   When built by jsenv, `self.resourcesFromJsenvBuild` holds this object
   *   pre-filled with every resource of the build.
   * @param {Object} [options.actions={}] Extra `{ action: async fn }` handlers
   *   callable from the page via @jsenv/pwa `sendMessage({ action, payload })`.
   * @param {Function} [options.install] Called during the "install" event.
   * @param {Function} [options.activate] Called during the "activate" event.
   */
  sw.init = ({
    name = "jsenv",
    version = "1",
    meta = {},
    logLevel = "warn",
    logBackgroundColor = "#ffdc00", // nice yellow
    logColor = "#000000",
    resources = {
      "/": {},
    },
    actions = {},
    install = () => {},
    activate = () => {},
  } = {}) => {
    if (typeof resources !== "object") {
      throw new TypeError(`resources should be an object, got ${resources}`);
    }
    if (typeof name !== "string") {
      throw new TypeError(`name should be a string, got ${name}`);
    }
    if (name.length === 0) {
      throw new TypeError(`name must not be empty`);
    }
    if (typeof logLevel !== "string") {
      throw new TypeError(`logLevel should be a string, got ${logLevel}`);
    }
    if (typeof logBackgroundColor !== "string") {
      throw new TypeError(
        `logBackgroundColor should be a string, got ${logBackgroundColor}`,
      );
    }
    if (typeof logColor !== "string") {
      throw new TypeError(`logColor should be a string, got ${logColor}`);
    }

    const logger = createLogger({ logLevel, logBackgroundColor, logColor });
    resources = resolveResources(resources);
    const cacheName = createCacheName(name, { version, resources });
    const label = cacheName;

    // --- init phase ---
    {
      logger.info(`init (${label})`);
      sw.registerActions({
        inspect: () => {
          return {
            name,
            version,
            resources,
            ...meta,
          };
        },
        refreshCacheKey: async (url) => {
          url = asAbsoluteUrl(url);
          const cache = await self.caches.open(cacheName);
          const request = new Request(url, { cache: "reload" });
          return fetchAndPutInCache(request, cache);
        },
        addCacheKey: async (url) => {
          url = asAbsoluteUrl(url);
          const cache = await self.caches.open(cacheName);
          const request = new Request(url);
          return fetchAndPutInCache(request, cache);
        },
        removeCacheKey: async (url) => {
          url = asAbsoluteUrl(url);
          const cache = await self.caches.open(cacheName);
          const deleted = await cache.delete(url);
          return deleted;
        },
        ...actions,
      });
    }

    // --- installation phase ---
    {
      sw.registerActions({
        skipWaiting: () => {
          self.skipWaiting();
        },
      });
      self.addEventListener("install", (installEvent) => {
        logger.info(`install (${label})`);
        const installPromise = Promise.all([
          handleInstallEvent(installEvent),
          install(installEvent),
        ]);
        installEvent.waitUntil(installPromise);
      });
      const handleInstallEvent = async () => {
        logger.debug(`open cache`);
        const cache = await self.caches.open(cacheName);
        const urlsToCache = Object.keys(resources);
        const total = urlsToCache.length;
        let installed = 0;
        await Promise.all(
          urlsToCache.map(async (url) => {
            const resource = resources[url];
            const request = resource.versionedUrl
              ? new Request(resource.versionedUrl)
              : // A non versioned url must ignore navigator cache
                // otherwise we might (99% chances) hit previous worker cache
                // and miss the new version
                new Request(url, { cache: "reload" });
            try {
              const response = await fetchAndPutInCache(request, cache);
              if (response.status === 200) {
                logger.info(`put "${asRelativeUrl(request.url)}" into cache`);
                installed += 1;
              } else {
                logger.warn(
                  `cannot put ${request.url} into cache due to response status (${response.status})`,
                );
              }
            } catch (e) {
              logger.warn(
                `cannot put ${request.url} in cache due to error while fetching: ${e.stack}`,
              );
            }
          }),
        );
        if (installed === total) {
          logger.info(`install done (${total} resources added in cache)`);
        } else {
          logger.info(
            `install done (${installed}/${total} resources added in cache)`,
          );
        }
      };
    }

    // --- activation phase ---
    {
      self.addEventListener("activate", (activateEvent) => {
        logger.info(`activate (${label})`);
        const activatePromise = Promise.all([
          handleActivateEvent(activateEvent),
          activate(activateEvent),
        ]);
        activateEvent.waitUntil(activatePromise);
      });
      sw.registerActions({
        claim: async () => {
          await self.clients.claim();
        },
        postReloadAfterUpdateToClients: async () => {
          const matchingClients = await self.clients.matchAll();
          matchingClients.forEach((matchingClient) => {
            matchingClient.postMessage("reload_after_update");
          });
        },
      });
      const handleActivateEvent = async () => {
        const cacheKeys = await self.caches.keys();
        await Promise.all(
          cacheKeys.map(async (cacheKey) => {
            if (cacheKey !== cacheName && cacheKey.startsWith(`${name}_`)) {
              logger.info(`delete old cache "${cacheKey}"`);
              await self.caches.delete(cacheKey);
            }
          }),
        );
      };
    }

    // --- fetch implementation ---
    {
      self.addEventListener("fetch", (fetchEvent) => {
        const request = fetchEvent.request;
        if (request.method !== "GET" && request.method !== "HEAD") {
          return;
        }
        let requestWasCachedOnInstall = false;
        if (resources[request.url]) {
          requestWasCachedOnInstall = true;
        } else {
          for (const url of Object.keys(resources)) {
            if (resources[url].versionedUrl === request.url) {
              requestWasCachedOnInstall = true;
              break;
            }
          }
        }
        if (!requestWasCachedOnInstall) {
          // not returning a response -> browser handles the request as usual
          return;
        }
        // respondWith must be called synchronously inside the "fetch" listener
        fetchEvent.respondWith(handleFetchEvent(fetchEvent));
      });
      const handleFetchEvent = async (fetchEvent) => {
        const request = fetchEvent.request;
        const relativeUrl = asRelativeUrl(request.url);
        logger.debug(`fetch "${relativeUrl}" (${label})`);
        if (request.mode === "navigate") {
          const preloadResponsePromise = fetchEvent.preloadResponse;
          if (preloadResponsePromise) {
            logger.debug(
              "preloadResponse available on navigation request, try to use it",
            );
            const preloadResponse = await getPreloadResponse(
              preloadResponsePromise,
            );
            if (preloadResponse) {
              logger.info(`${relativeUrl} -> use preloaded response`);
              return preloadResponse;
            }
            logger.debug("cannot use preloadResponse");
          }
        }
        try {
          logger.debug(`open ${cacheName} cache`);
          const cache = await self.caches.open(cacheName);
          logger.debug(`search response matching this request in cache`);
          const responseFromCache = await cache.match(request);
          if (responseFromCache) {
            logger.info(`${relativeUrl} -> use cache`);
            return responseFromCache;
          }
          logger.info(`${relativeUrl} -> delegate to navigator`);
          return self.fetch(request);
        } catch (e) {
          logger.warn(
            `error while trying to use cache for ${relativeUrl} -> delegate to navigator`,
            e.stack,
          );
          return self.fetch(request);
        }
      };
      const getPreloadResponse = async (preloadResponse) => {
        // see https://github.com/GoogleChrome/workbox/issues/3134
        try {
          const response = await preloadResponse;
          if (response && response.type === "error") {
            return null;
          }
          return response;
        } catch {
          return null;
        }
      };
    }
  };
}

// The cache name must be deterministic: the navigator kills the service worker
// whenever it's idle and re-executes this whole script on the next event, so a
// name derived from randomness/time would designate a different (empty) cache
// on every wake-up, making the cache filled during "install" unreachable.
// It must still change when the service worker script changes, so that each
// worker version gets its own cache and "activate" can delete the previous
// ones — hashing version + resources gives exactly that.
const createCacheName = (name, { version, resources }) => {
  const hash = hashString(JSON.stringify({ version, resources }));
  return `${name}_${hash}`;
};

const hashString = (string) => {
  let hash = 5381;
  let i = string.length;
  while (i--) {
    hash = (hash * 33) ^ string.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const createLogger = ({ logLevel, logBackgroundColor, logColor }) => {
  const injectLogStyles = (args) => {
    return [
      `%cjsenv%csw`,
      `background: orange; color: rgb(55, 7, 7); padding: 1px 3px; margin: 0 1px`,
      `background: ${logBackgroundColor}; color: ${logColor}; padding: 1px 3px; margin: 0 1px`,
      ...args,
    ];
  };

  const logger = {
    debug: (...args) => {
      if (logLevel === "debug") {
        console.info(...injectLogStyles(args));
      }
    },
    info: (...args) => {
      if (logLevel === "debug" || logLevel === "info") {
        console.info(...injectLogStyles(args));
      }
    },
    warn: (...args) => {
      if (logLevel === "debug" || logLevel === "info" || logLevel === "warn") {
        console.info(...injectLogStyles(args));
      }
    },
    error: (...args) => {
      if (
        logLevel === "debug" ||
        logLevel === "info" ||
        logLevel === "warn" ||
        logLevel === "error"
      ) {
        console.info(...injectLogStyles(args));
      }
    },
    debugGroupCollapsed: (...args) => {
      if (logLevel === "debug") {
        console.groupCollapsed(...injectLogStyles(args));
      }
    },
    infoGroupCollapsed: (...args) => {
      if (logLevel === "debug" || logLevel === "info") {
        console.groupCollapsed(...injectLogStyles(args));
      }
    },
    groupEnd: () => console.groupEnd(),
  };
  return logger;
};

const asAbsoluteUrl = (relativeUrl) =>
  String(new URL(relativeUrl, self.location));

const asRelativeUrl = (url) => url.slice(self.location.origin.length);

const resolveResources = (resources) => {
  const resourcesResolved = {};
  Object.keys(resources).forEach((url) => {
    const info = resources[url];
    const urlResolved = asAbsoluteUrl(url);
    if (info.versionedUrl) {
      info.versionedUrl = asAbsoluteUrl(info.versionedUrl);
    }
    resourcesResolved[urlResolved] = info;
  });
  return resourcesResolved;
};

const fetchAndPutInCache = async (request, cache) => {
  const response = await self.fetch(request);
  if (response.status === 200) {
    const responseToCache = await asResponseToPutInCache(response);
    await cache.put(request, responseToCache);
  }
  return response;
};

const asResponseToPutInCache = async (response) => {
  const responseClone = response.clone();
  if (!response.redirected) {
    return responseClone;
  }
  // When passed a redirected response, this will create a new, "clean" response
  // that can be used to respond to a navigation request.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=669363&desc=2#c1

  // Not all browsers support the Response.body stream, so fall back to reading
  // the entire body into memory as a blob.
  const bodyPromise =
    "body" in responseClone
      ? Promise.resolve(responseClone.body)
      : responseClone.blob();
  const body = await bodyPromise;
  // new Response() is happy when passed either a stream or a Blob.
  return new Response(body, {
    headers: responseClone.headers,
    status: responseClone.status,
    statusText: responseClone.statusText,
  });
};
