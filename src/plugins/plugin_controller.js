import { timeStart } from "@jsenv/server"

export const createPluginController = ({
  plugins,
  scenario,
  hooks = [
    "init",
    "resolveUrl",
    "redirectUrl",
    "fetchUrlContent",
    "transformUrlContent",
    "transformUrlSearchParams",
    "formatUrl",
    "finalizeUrlContent",
    "cooked",
    "destroy",
  ],
}) => {
  plugins = flattenAndFilterPlugins(plugins, { scenario })
  // precompute a list of hooks per hookName
  // For one major reason:
  // - When debugging, there is less iteration
  // And also it should increase perf as there is less work to do
  const hookGroups = {}
  const addHook = (hookName) => {
    const hooks = []
    plugins.forEach((plugin) => {
      const hook = plugin[hookName]
      if (hook) {
        hooks.push({
          plugin,
          hookName,
          value: hook,
        })
      }
    })
    hookGroups[hookName] = hooks
    return hooks
  }
  hooks.forEach((hookName) => {
    addHook(hookName)
  })

  const pushPlugin = (plugin) => {
    plugins.push(plugin)
    hooks.forEach((hookName) => {
      const hook = plugin[hookName]
      if (hook) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = [])
        group.push({
          plugin,
          hookName,
          value: hook,
        })
      }
    })
  }

  let currentPlugin = null
  let currentHookName = null
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info)
    if (!hookFn) {
      return null
    }
    currentPlugin = hook.plugin
    currentHookName = hook.hookName
    const timeEnd = timeStart(
      `${currentHookName}-${currentPlugin.name.replace("jsenv:", "")}`,
    )
    let valueReturned = hookFn(info, context)
    if (info.timing) {
      Object.assign(info.timing, timeEnd())
    }
    valueReturned = assertAndNormalizeReturnValue(hook.hookName, valueReturned)
    currentPlugin = null
    currentHookName = null
    return valueReturned
  }
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info)
    if (!hookFn) {
      return null
    }
    currentPlugin = hook.plugin
    currentHookName = hook.hookName
    const timeEnd = timeStart(
      `${currentHookName}-${currentPlugin.name.replace("jsenv:", "")}`,
    )
    let valueReturned = await hookFn(info, context)
    if (info.timing) {
      Object.assign(info.timing, timeEnd())
    }
    valueReturned = assertAndNormalizeReturnValue(hook.hookName, valueReturned)
    currentPlugin = null
    currentHookName = null
    return valueReturned
  }

  const callHooks = (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName]
    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context)
      if (returnValue) {
        callback(returnValue)
      }
    }
  }
  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName]
    await hooks.reduce(async (previous, hook) => {
      await previous
      const returnValue = await callAsyncHook(hook, info, context)
      if (returnValue && callback) {
        await callback(returnValue)
      }
    }, Promise.resolve())
  }

  const callHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
    for (const hook of hooks) {
      const returnValue = callHook(hook, info, context)
      if (returnValue) {
        return returnValue
      }
    }
    return null
  }
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
    if (hooks.length === 0) {
      return null
    }
    return new Promise((resolve, reject) => {
      const visit = (index) => {
        if (index >= hooks.length) {
          return resolve()
        }
        const hook = hooks[index]
        const returnValue = callAsyncHook(hook, info, context)
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
    plugins,
    pushPlugin,
    addHook,
    getHookFunction,
    callHook,
    callAsyncHook,

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
    if (typeof pluginEntry === "object" && pluginEntry !== null) {
      if (!pluginEntry.name) {
        pluginEntry.name = "anonymous"
      }
      const { appliesDuring } = pluginEntry
      if (appliesDuring === undefined) {
        console.warn(`"appliesDuring" is undefined on ${pluginEntry.name}`)
        return
      }
      if (appliesDuring === "*") {
        plugins.push(pluginEntry)
        return
      }
      if (typeof appliesDuring === "string") {
        if (!["dev", "build", "test"].includes(appliesDuring)) {
          throw new Error(
            `"appliesDuring" must be "dev", "test" or "build", got ${appliesDuring}`,
          )
        }
        if (appliesDuring === scenario) {
          plugins.push(pluginEntry)
        }
        return
      }
      if (typeof appliesDuring !== "object") {
        throw new Error(
          `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
        )
      }
      if (appliesDuring[scenario]) {
        plugins.push(pluginEntry)
        return
      }
      if (pluginEntry.destroy) {
        pluginEntry.destroy()
      }
      return
    }
    throw new Error(`plugin must be objects, got ${pluginEntry}`)
  }
  pluginsRaw.forEach((plugin) => visitPluginEntry(plugin))
  return plugins
}

const getHookFunction = (
  hook,
  // can be undefined, reference, or urlInfo
  info = {},
) => {
  const hookValue = hook.value
  if (typeof hookValue === "object") {
    const hookForType = hookValue[info.type] || hookValue["*"]
    if (!hookForType) {
      return null
    }
    return hookForType
  }
  return hookValue
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
    appliesTo: ["resolveUrl", "redirectUrl"],
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
    appliesTo: [
      "fetchUrlContent",
      "transformUrlContent",
      "finalizeUrlContent",
      "optimizeUrlContent",
    ],
    assertion: (valueReturned) => {
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        return { content: valueReturned }
      }
      if (typeof valueReturned === "object") {
        const { shouldHandle, content, body } = valueReturned
        if (shouldHandle === false) {
          return undefined
        }
        if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
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
