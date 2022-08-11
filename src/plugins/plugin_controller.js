import { performance } from "node:perf_hooks"

const HOOK_NAMES = [
  "init",
  "serve", // is called only during dev/tests
  "resolveUrl",
  "redirectUrl",
  "fetchUrlContent",
  "transformUrlContent",
  "transformUrlSearchParams",
  "formatUrl",
  "finalizeUrlContent",
  "bundle", // is called only during build
  "optimizeUrlContent", // is called only during build
  "cooked",
  "augmentResponse", // is called only during dev/tests
  "destroy",
]

export const createPluginController = ({ plugins, scenarios }) => {
  const flatPlugins = flattenAndFilterPlugins(plugins, { scenarios })
  // precompute a list of hooks per hookName for one major reason:
  // - When debugging, there is less iteration
  // also it should increase perf as there is less work to do

  const hookGroups = {}
  const addPlugin = (plugin, { position = "start" }) => {
    Object.keys(plugin).forEach((key) => {
      if (key === "name" || key === "appliesDuring" || key === "serverEvents") {
        return
      }
      const isHook = HOOK_NAMES.includes(key)
      if (!isHook) {
        console.warn(`Unexpected "${key}" property on "${plugin.name}" plugin`)
      }
      const hookName = key
      const hookValue = plugin[hookName]
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = [])
        const hook = {
          plugin,
          name: hookName,
          value: hookValue,
        }
        if (position === "start") {
          group.push(hook)
        } else {
          group.unshift(hook)
        }
      }
    })
  }
  const pushPlugin = (plugin) => {
    addPlugin(plugin, { position: "start" })
  }
  const unshiftPlugin = (plugin) => {
    addPlugin(plugin, { position: "end" })
  }
  flatPlugins.forEach((plugin) => {
    pushPlugin(plugin)
  })

  let currentPlugin = null
  let currentHookName = null
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info)
    if (!hookFn) {
      return null
    }
    let startTimestamp
    if (info.timing) {
      startTimestamp = performance.now()
    }
    currentPlugin = hook.plugin
    currentHookName = hook.name
    let valueReturned = hookFn(info, context)
    currentPlugin = null
    currentHookName = null
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp
    }
    valueReturned = assertAndNormalizeReturnValue(hook.name, valueReturned)
    return valueReturned
  }
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info)
    if (!hookFn) {
      return null
    }

    let startTimestamp
    if (info.timing) {
      startTimestamp = performance.now()
    }
    currentPlugin = hook.plugin
    currentHookName = hook.name
    let valueReturned = await hookFn(info, context)
    currentPlugin = null
    currentHookName = null
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp
    }
    valueReturned = assertAndNormalizeReturnValue(hook.name, valueReturned)
    return valueReturned
  }

  const callHooks = (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName]
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context)
        if (returnValue && callback) {
          callback(returnValue, hook.plugin)
        }
      }
    }
  }
  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hooks = hookGroups[hookName]
    if (hooks) {
      await hooks.reduce(async (previous, hook) => {
        await previous
        const returnValue = await callAsyncHook(hook, info, context)
        if (returnValue && callback) {
          await callback(returnValue, hook.plugin)
        }
      }, Promise.resolve())
    }
  }

  const callHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info, context)
        if (returnValue) {
          return returnValue
        }
      }
    }
    return null
  }
  const callAsyncHooksUntil = (hookName, info, context) => {
    const hooks = hookGroups[hookName]
    if (!hooks) {
      return null
    }
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
    plugins: flatPlugins,
    pushPlugin,
    unshiftPlugin,
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

const flattenAndFilterPlugins = (plugins, { scenarios }) => {
  const flatPlugins = []
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
        // console.debug(`"appliesDuring" is undefined on ${pluginEntry.name}`)
        flatPlugins.push(pluginEntry)
        return
      }
      if (appliesDuring === "*") {
        flatPlugins.push(pluginEntry)
        return
      }
      if (typeof appliesDuring === "string") {
        if (!["dev", "build"].includes(appliesDuring)) {
          throw new Error(
            `"appliesDuring" must be "dev" or "build", got ${appliesDuring}`,
          )
        }
        if (scenarios[appliesDuring]) {
          flatPlugins.push(pluginEntry)
          return
        }
        return
      }
      if (typeof appliesDuring !== "object") {
        throw new Error(
          `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
        )
      }
      let applies
      for (const key of Object.keys(appliesDuring)) {
        if (!appliesDuring[key] && scenarios[key]) {
          applies = false
          break
        }
        if (appliesDuring[key] && scenarios[key]) {
          applies = true
        }
      }
      if (applies) {
        flatPlugins.push(pluginEntry)
        return
      }
      if (pluginEntry.destroy) {
        pluginEntry.destroy()
      }
      return
    }
    throw new Error(`plugin must be objects, got ${pluginEntry}`)
  }
  plugins.forEach((plugin) => visitPluginEntry(plugin))
  return flatPlugins
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
