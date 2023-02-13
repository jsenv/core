export const createUpdateHotHandler = ({
  hotUpdateHandlers,
  fromScriptMeta,
  toScriptMeta,
}) => {
  const actions = []
  if (!fromScriptMeta || !fromScriptMeta.resources) {
    // service worker current script do not expose meta
    return null
  }
  if (!toScriptMeta || !toScriptMeta.resources) {
    // service worker update script do not expose meta
    return null
  }
  const fromResources = fromScriptMeta.resources
  const toResources = toScriptMeta.resources

  const getOneUpdateHotHandler = ({
    fromUrl,
    toUrl,
    fromUrlMeta,
    toUrlMeta,
  }) => {
    const url = fromUrl || toUrl
    let handler = hotUpdateHandlers[url]
    if (!handler) {
      return null
    }
    if (typeof handler === "function") {
      return handler({ fromUrl, toUrl, fromUrlMeta, toUrlMeta })
    }
    if (!toUrlMeta) {
      return handler.remove || null
    }
    if (!fromUrlMeta) {
      return handler.add || null
    }
    return handler.replace || null
  }

  const fromUrls = Object.keys(fromResources)
  const toUrls = Object.keys(toResources)
  for (const fromUrl of fromUrls) {
    const fromUrlMeta = fromResources[fromUrl]
    const toUrlMeta = toResources[fromUrl]
    // remove
    if (!toUrlMeta) {
      const updateHandler = getOneUpdateHotHandler({
        fromUrl,
        fromUrlMeta,
        toUrl: null,
        toUrlMeta: null,
      })
      if (!updateHandler) {
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
        fromUrl,
        fromUrlMeta,
        toUrl: fromUrl,
        toUrlMeta,
      })
      if (!updateHandler) {
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
      fromUrl: null,
      fromUrlMeta: null,
      toUrl,
      toUrlMeta,
    })
    if (!updateHandler) {
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
    return null
  }
  return async () => {
    await Promise.all(
      actions.map(async (action) => {
        await action.fn()
      }),
    )
  }
}
