export const callPluginHook = async (plugin, hookName, params) => {
  let hook = plugin[hookName]
  if (!hook) {
    return null
  }
  if (typeof hook === "object") {
    hook = hook[hookName === "resolve" ? params.specifierType : params.type]
    if (!hook) {
      return null
    }
  }
  try {
    return await hook(params)
  } catch (e) {
    if (e && e.asResponse) {
      throw e
    }
    if (e && e.statusText === "Unexpected directory operation") {
      e.asResponse = () => {
        return {
          status: 403,
        }
      }
      throw e
    }
    throw e
  }
}

export const callPluginSyncHook = (plugin, hookName, params) => {
  let hook = plugin[hookName]
  if (!hook) {
    return null
  }
  if (typeof hook === "object") {
    hook = hook[params.type]
    if (!hook) {
      return null
    }
  }
  return hook(params)
}
