import { getJsenvPlugins } from "../jsenv_plugins.js"

export const createPluginController = ({
  plugins,
  scenario,
  injectJsenvPlugins,
}) => {
  if (injectJsenvPlugins) {
    plugins = [...plugins, ...getJsenvPlugins()]
  }
  plugins = flattenAndFilterPlugins(plugins, { scenario })

  let currentPlugin = null
  let currentHookName = null
  const callPluginHook = (plugin, hookName, info, context) => {
    const hook = getPluginHook(plugin, hookName, info)
    if (!hook) {
      return null
    }
    currentPlugin = plugin
    currentHookName = hookName
    let valueReturned = hook(info, context)
    valueReturned = assertAndNormalizeReturnValue(hookName, valueReturned)
    currentPlugin = null
    currentHookName = null
    return valueReturned
  }
  const callPluginAsyncHook = async (plugin, hookName, info, context) => {
    const hook = getPluginHook(plugin, hookName, info)
    if (!hook) {
      return null
    }
    currentPlugin = plugin
    currentHookName = hookName
    let valueReturned = await hook(info, context)
    valueReturned = assertAndNormalizeReturnValue(hookName, valueReturned)
    currentPlugin = null
    currentHookName = null
    return valueReturned
  }

  const callHooks = (hookName, info, context, callback) => {
    for (const plugin of plugins) {
      const returnValue = callPluginHook(plugin, hookName, info, context)
      if (returnValue) {
        callback(returnValue)
      }
    }
  }
  const callAsyncHooks = async (hookName, info, context, callback) => {
    await plugins.reduce(async (previous, plugin) => {
      await previous
      const returnValue = await callPluginAsyncHook(
        plugin,
        hookName,
        info,
        context,
      )
      if (returnValue && callback) {
        callback(returnValue)
      }
    }, Promise.resolve())
  }

  const callHooksUntil = (hookName, info, context) => {
    for (const plugin of plugins) {
      const returnValue = callPluginHook(plugin, hookName, info, context)
      if (returnValue) {
        return returnValue
      }
    }
    return null
  }
  const callAsyncHooksUntil = (hookName, info, context) => {
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= plugins.length) {
          return resolve()
        }
        const plugin = plugins[index]
        const returnValue = callPluginAsyncHook(plugin, hookName, info, context)
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

  callHooks("init", {
    // which params?
  })

  return {
    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,

    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName,
  }
}

const flattenAndFilterPlugins = (pluginsRaw, { scenario }) => {
  const plugins = []
  const visitPluginEntry = (pluginEntry) => {
    if (Array.isArray(pluginEntry)) {
      pluginEntry.forEach((value) => visitPluginEntry(value))
      return
    }
    if (typeof pluginEntry === "function") {
      throw new Error(`plugin must be objects, got a function`)
    }
    if (typeof pluginEntry === "object") {
      const { appliesDuring } = pluginEntry
      if (appliesDuring === undefined) {
        console.warn(`"appliesDuring" is undefined on ${pluginEntry.name}`)
      }
      if (appliesDuring === "*") {
        plugins.push(pluginEntry)
        return
      }
      if (appliesDuring && appliesDuring[scenario]) {
        plugins.push(pluginEntry)
        return
      }
    }
  }
  pluginsRaw.forEach((plugin) => visitPluginEntry(plugin))
  return plugins
}

const getPluginHook = (
  plugin,
  hookName,
  // can be specifierInfo or urlInfo
  info,
) => {
  const hook = plugin[hookName]
  if (!hook) {
    return null
  }
  if (typeof hook === "function") {
    return hook
  }
  if (typeof hook === "object") {
    const hookForType = hook[info.type] || hook["*"]
    if (!hookForType) {
      return null
    }
    return hookForType
  }
  return null
}

const assertAndNormalizeReturnValue = (hookName, returnValue) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue
  }
  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hookName)) {
      continue
    }
    const assertionResult = returnValueAssertion.assertion(returnValue)
    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult
      break
    }
  }
  return returnValue
}

const returnValueAssertions = [
  {
    name: "url_assertion",
    appliesTo: ["resolve", "redirect"],
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
    appliesTo: ["load", "transform", "finalize"],
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
