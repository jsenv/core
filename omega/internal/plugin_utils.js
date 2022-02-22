import { findAsync } from "./find_async.js"

export const callPluginsHook = async (plugins, hookName, params) => {
  return findAsync({
    array: plugins,
    start: (plugin) => {
      const hook = plugin[hookName]
      if (hook) {
        return hook(params)
      }
      return null
    },
    predicate: (returnValue) =>
      returnValue !== null && returnValue !== undefined,
  })
}
