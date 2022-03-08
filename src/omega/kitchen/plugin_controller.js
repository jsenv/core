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
    let valueReturned = await hook(params)
    // all hooks are allowed to return null/undefined
    if (valueReturned !== null && valueReturned !== undefined) {
      for (const returnValueAssertion of returnValueAssertions) {
        if (!returnValueAssertions.appliesTo.includes(hookName)) {
          continue
        }
        const assertionResult = returnValueAssertion.assertion(valueReturned)
        if (assertionResult !== undefined) {
          // normalization
          valueReturned = assertionResult
          break
        }
      }
    }
    currentPlugin = null
    currentHookName = null
    return valueReturned
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

const returnValueAssertions = [
  {
    name: "url_assertion",
    appliesTo: ["resolve"],
    assertion: (valueReturned) => {
      if (valueReturned instanceof URL) {
        return valueReturned.href
      }
      if (typeof valueReturned === "string") {
        return undefined
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string; got ${valueReturned}`,
      )
    },
  },
  {
    name: "content_assertion",
    appliesTo: ["load", "transform", "render"],
    assertion: (valueReturned) => {
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        return { content: valueReturned }
      }
      if (typeof valueReturned === "object") {
        const { content } = valueReturned
        if (typeof content !== "string" && !Buffer.isBuffer(content)) {
          throw new Error(
            `Unexpected "content" returned by plugin: it must be a string or a buffer; got ${content}`,
          )
        }
        return undefined
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string, a buffer or an object; got ${valueReturned}`,
      )
    },
  },
]
