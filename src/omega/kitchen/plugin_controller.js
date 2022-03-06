export const createPluginController = () => {
  let currentPlugin = null
  let currentHookName = null

  const callPluginHook = async (plugin, hookName, params) => {
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
    currentPlugin = plugin
    currentHookName = hookName
    const returnValue = await hook(params)
    if (hookName === "transform" || hookName === "render") {
      if (!returnValue) {
        currentPlugin = null
        currentHookName = null
        return null
      }
      if (typeof returnValue === "string" || Buffer.isBuffer(returnValue)) {
        currentPlugin = null
        currentHookName = null
        return { content: returnValue }
      }
      if (typeof returnValue === "object") {
        const { content } = returnValue
        if (typeof content !== "string" && !Buffer.isBuffer(content)) {
          throw new Error(
            `Unexpected "content" returned by plugin: it must be a string or a buffer; got ${content}`,
          )
        }
        currentPlugin = null
        currentHookName = null
        return returnValue
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string, a buffer or an object; got ${returnValue}`,
      )
    }
    currentPlugin = null
    currentHookName = null
    return returnValue
  }

  const callPluginSyncHook = (plugin, hookName, params) => {
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
    currentPlugin = plugin
    currentHookName = hookName
    const returnValue = hook(params)
    currentPlugin = null
    currentHookName = null
    return returnValue
  }

  const callPluginHooksUntil = (plugins, hookName, params) => {
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= plugins.length) {
          return resolve()
        }
        const plugin = plugins[index]
        const returnValue = callPluginHook(plugin, hookName, params)
        return Promise.resolve(returnValue).then((output) => {
          if (output) {
            return resolve(output)
          }
          return visit(index + 1)
        }, reject)
      }
      visit(0)
    })
  }

  return {
    callPluginHook,
    callPluginSyncHook,
    callPluginHooksUntil,

    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName,
  }
}
