import { pwaLogger } from "../pwa_logger.js"

export const createServiceWorkerHotReplacer = ({
  resourceUpdateHandlers,
  fromScriptMeta,
  toScriptMeta,
}) => {
  const actions = []
  if (!fromScriptMeta || !fromScriptMeta.resources) {
    pwaLogger.debug("current sw script does not expose resources")
    return null
  }
  if (!toScriptMeta || !toScriptMeta.resources) {
    pwaLogger.debug("new sw script does not expose resources")
    return null
  }
  const fromVersion = fromScriptMeta.version
  const toVersion = toScriptMeta.version
  if (fromVersion !== toVersion) {
    pwaLogger.debug(`script version changed ${fromVersion}->${toVersion}`)
    return null
  }
  const fromResources = fromScriptMeta.resources
  const toResources = toScriptMeta.resources

  const getResourceUpdateHandler = (url) => {
    const resourceUpdateHandler = resourceUpdateHandlers[url]
    if (resourceUpdateHandler) {
      return resourceUpdateHandler
    }
    // defineResourceUpdateHandler might be called with the versioned url (in case import.meta.url is used)
    // so we'll try to find the non versioned url instead
    const fromVersionedUrl = fromResources[url]
      ? fromResources[url].versionedUrl
      : ""
    if (fromVersionedUrl) {
      const fromHandler = resourceUpdateHandlers[fromVersionedUrl]
      if (fromHandler) {
        resourceUpdateHandlers[url] = fromHandler
        return fromHandler
      }
    }
    const toVersionedUrl = toResources[url] ? toResources[url].versionedUrl : ""
    if (toVersionedUrl) {
      const toHandler = resourceUpdateHandlers[toVersionedUrl]
      if (toHandler) {
        return toHandler
      }
    }
    return null
  }

  const getOneUpdateHotHandler = ({
    url,
    fromUrl,
    toUrl,
    fromVersion,
    toVersion,
  }) => {
    let resourceUpdateHandler = getResourceUpdateHandler(url)
    if (typeof resourceUpdateHandler === "function") {
      resourceUpdateHandler = resourceUpdateHandler({
        fromUrl,
        toUrl,
        fromVersion,
        toVersion,
      })
      if (typeof resourceUpdateHandler !== "object") {
        throw new TypeError(
          `resource uupdate hanler must be an object, got ${resourceUpdateHandler}`,
        )
      }
    }
    if (resourceUpdateHandler === null || resourceUpdateHandler === undefined) {
      return null
    }
    if (!toUrl) {
      if (resourceUpdateHandler.remove) {
        return () =>
          resourceUpdateHandler.remove({
            fromUrl,
            toUrl,
            fromVersion,
            toVersion,
          })
      }
      return null
    }
    if (!fromUrl) {
      if (resourceUpdateHandler.add) {
        return () =>
          resourceUpdateHandler.add({ fromUrl, toUrl, fromVersion, toVersion })
      }
      return null
    }
    if (resourceUpdateHandler.replace) {
      return () =>
        resourceUpdateHandler.replace({
          fromUrl,
          toUrl,
          fromVersion,
          toVersion,
        })
    }
    return null
  }

  const fromUrls = Object.keys(fromResources)
  const toUrls = Object.keys(toResources)
  for (const fromUrl of fromUrls) {
    const fromUrlMeta = fromResources[fromUrl]
    const toUrlMeta = toResources[fromUrl]
    // remove
    if (!toUrlMeta) {
      const updateHandler = getOneUpdateHotHandler({
        url: fromUrl,
        fromUrl: fromUrlMeta.versionedUrl || fromUrl,
        toUrl: null,
        fromVersion: fromUrlMeta.version || null,
        toVersion: null,
      })
      if (!updateHandler) {
        pwaLogger.debug(`nothing capable to handle removal of ${fromUrl}`)
        return null
      }
      actions.push({
        type: "remove",
        url: fromUrl,
        fn: updateHandler,
      })
      continue
    }
    // replace
    if (toUrlMeta.version !== fromUrlMeta.version) {
      const updateHandler = getOneUpdateHotHandler({
        url: fromUrl,
        fromUrl: fromUrlMeta.versionedUrl || fromUrl,
        toUrl: toUrlMeta.versionedUrl || fromUrl,
        fromVersion: fromUrlMeta.version || null,
        toVersion: toUrlMeta.version || null,
      })
      if (!updateHandler) {
        console.log({
          fromScriptMeta,
          toScriptMeta,
          fromUrl,
          fromResources,
          toResources,
          availableHandlers: Object.keys(resourceUpdateHandlers),
        })
        pwaLogger.debug(`nothing capable to handle update of ${fromUrl}`)
        return null
      }
      actions.push({
        type: "replace",
        url: fromUrl,
        fn: updateHandler,
      })
    }
  }
  // add
  for (const toUrl of toUrls) {
    if (fromUrls.includes(toUrl)) {
      continue // already handled in previous loop
    }
    const toUrlMeta = toResources[toUrl]
    const updateHandler = getOneUpdateHotHandler({
      url: toUrl,
      fromUrl: null,
      toUrl: toUrlMeta.versionedUrl || toUrl,
      fromVersion: null,
      toVersion: toUrlMeta.version || null,
    })
    if (!updateHandler) {
      pwaLogger.debug(`nothing capable to handle introduction of ${toUrl}`)
      return null
    }
    actions.push({
      type: "add",
      url: toUrl,
      fn: updateHandler,
    })
  }

  // if nothing has changed it means it's the worker implementation (the code)
  // that has changed, so we need to reload
  if (actions.length === 0) {
    pwaLogger.debug(`resources are the same`)
    return null
  }
  return async () => {
    await Promise.all(
      actions.map(async (action) => {
        pwaLogger.debug(`call "${action.type}" handler for ${action.url}`)
        await action.fn()
      }),
    )
  }
}
