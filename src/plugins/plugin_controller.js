import { performance } from "node:perf_hooks";

const HOOK_NAMES = [
  "init",
  "serve", // is called only during dev/tests
  "resolveReference",
  "redirectReference",
  "transformReferenceSearchParams",
  "formatReference",
  "fetchUrlContent",
  "transformUrlContent",
  "finalizeUrlContent",
  "bundle", // is called only during build
  "optimizeUrlContent", // is called only during build
  "cooked",
  "augmentResponse", // is called only during dev/tests
  "destroy",
  "effect",
];

export const createPluginController = (
  kitchenContext,
  initialPuginsMeta = {},
) => {
  const pluginsMeta = initialPuginsMeta;

  kitchenContext.getPluginMeta = (id) => {
    const value = pluginsMeta[id];
    return value;
  };

  const pluginCandidates = [];
  const activeEffectSet = new Set();
  const activePlugins = [];
  // precompute a list of hooks per hookName because:
  // 1. [MAJOR REASON] when debugging, there is less iteration (so much better)
  // 2. [MINOR REASON] it should increase perf as there is less work to do
  const hookSetMap = new Map();
  const addPlugin = (plugin, options) => {
    if (Array.isArray(plugin)) {
      for (const value of plugin) {
        addPlugin(value, options);
      }
      return;
    }
    if (plugin === null || typeof plugin !== "object") {
      throw new TypeError(`plugin must be objects, got ${plugin}`);
    }
    if (!plugin.name) {
      plugin.name = "anonymous";
    }
    if (!testAppliesDuring(plugin) || !initPlugin(plugin)) {
      plugin.destroy?.();
      return;
    }
    pluginCandidates.push(plugin);
  };
  const testAppliesDuring = (plugin) => {
    const { appliesDuring } = plugin;
    if (appliesDuring === undefined) {
      // console.debug(`"appliesDuring" is undefined on ${pluginEntry.name}`)
      return true;
    }
    if (appliesDuring === "*") {
      return true;
    }
    if (typeof appliesDuring === "string") {
      if (appliesDuring !== "dev" && appliesDuring !== "build") {
        throw new TypeError(
          `"appliesDuring" must be "dev" or "build", got ${appliesDuring}`,
        );
      }
      if (kitchenContext[appliesDuring]) {
        return true;
      }
      return false;
    }
    if (typeof appliesDuring === "object") {
      for (const key of Object.keys(appliesDuring)) {
        if (!appliesDuring[key] && kitchenContext[key]) {
          return false;
        }
        if (appliesDuring[key] && kitchenContext[key]) {
          return true;
        }
      }
      // throw new Error(`"appliesDuring" is empty`)
      return false;
    }
    throw new TypeError(
      `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
    );
  };
  const initPlugin = (plugin) => {
    const { init } = plugin;
    if (!init) {
      return true;
    }
    const initReturnValue = init(kitchenContext, { plugin });
    if (initReturnValue === false) {
      return false;
    }
    if (typeof initReturnValue === "function" && !plugin.destroy) {
      plugin.destroy = initReturnValue;
    }
    return true;
  };
  const pushPlugin = (...args) => {
    for (const arg of args) {
      addPlugin(arg);
    }
    updateActivePlugins();
  };
  const updateActivePlugins = () => {
    // construct activePlugins and hooks according
    // to the one present in candidates and their effects
    // 1. active plugins is an empty array
    // 2. all active effects are cleaned-up
    // 3. all effects are re-activated if still relevant
    // 4. hooks are precomputed according to plugin order

    // 1.
    activePlugins.length = 0;
    // 2.
    for (const { cleanup } of activeEffectSet) {
      cleanup();
    }
    activeEffectSet.clear();
    for (const pluginCandidate of pluginCandidates) {
      const effect = pluginCandidate.effect;
      if (!effect) {
        activePlugins.push(pluginCandidate);
        continue;
      }
    }
    // 3.
    for (const pluginCandidate of pluginCandidates) {
      const effect = pluginCandidate.effect;
      if (!effect) {
        continue;
      }
      const returnValue = effect({
        kitchenContext,
        otherPlugins: activePlugins,
      });
      if (!returnValue) {
        continue;
      }
      activePlugins.push(pluginCandidate);
      activeEffectSet.add({
        plugin: pluginCandidate,
        cleanup: typeof returnValue === "function" ? returnValue : () => {},
      });
    }
    // 4.
    activePlugins.sort((a, b) => {
      return pluginCandidates.indexOf(a) - pluginCandidates.indexOf(b);
    });
    hookSetMap.clear();
    for (const activePlugin of activePlugins) {
      for (const key of Object.keys(activePlugin)) {
        if (key === "meta") {
          const value = activePlugin[key];
          if (typeof value !== "object" || value === null) {
            console.warn(`plugin.meta must be an object, got ${value}`);
            continue;
          }
          Object.assign(pluginsMeta, value);
          // any extension/modification on plugin.meta
          // won't be taken into account so we freeze object
          // to throw in case it happen
          Object.freeze(value);
          continue;
        }
        if (
          key === "name" ||
          key === "appliesDuring" ||
          key === "init" ||
          key === "serverEvents" ||
          key === "mustStayFirst" ||
          key === "effect"
        ) {
          continue;
        }
        const isHook = HOOK_NAMES.includes(key);
        if (!isHook) {
          console.warn(
            `Unexpected "${key}" property on "${activePlugin.name}" plugin`,
          );
          continue;
        }
        const hookName = key;
        const hookValue = activePlugin[hookName];
        if (hookValue) {
          let hookSet = hookSetMap.get(hookName);
          if (!hookSet) {
            hookSet = new Set();
            hookSetMap.set(hookName, hookSet);
          }
          const hook = {
            plugin: activePlugin,
            name: hookName,
            value: hookValue,
          };
          // if (position === "start") {
          //   let i = 0;
          //   while (i < group.length) {
          //     const before = group[i];
          //     if (!before.plugin.mustStayFirst) {
          //       break;
          //     }
          //     i++;
          //   }
          //   group.splice(i, 0, hook);
          // } else {
          hookSet.add(hook);
        }
      }
    }
  };

  let lastPluginUsed = null;
  let currentPlugin = null;
  let currentHookName = null;
  const callHook = (hook, info) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = hookFn(info);
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }

    let startTimestamp;
    if (info.timing) {
      startTimestamp = performance.now();
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let valueReturned = await hookFn(info);
    if (info.timing) {
      info.timing[`${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`] =
        performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(hook, valueReturned, info);
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };

  const callHooks = (hookName, info, callback) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    const setHookParams = (firstArg = info) => {
      info = firstArg;
    };
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info);
      if (returnValue && callback) {
        callback(returnValue, hook.plugin, setHookParams);
      }
    }
  };
  const callAsyncHooks = async (hookName, info, callback, options) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = await callAsyncHook(hook, info, options);
      if (returnValue && callback) {
        await callback(returnValue, hook.plugin);
      }
    }
  };

  const callHooksUntil = (hookName, info) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info);
      if (returnValue) {
        return returnValue;
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, options) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    if (hookSet.size === 0) {
      return null;
    }
    const iterator = hookSet.values()[Symbol.iterator]();
    let result;
    const visit = async () => {
      const { done, value: hook } = iterator.next();
      if (done) {
        return;
      }
      const returnValue = await callAsyncHook(hook, info, options);
      if (returnValue) {
        result = returnValue;
        return;
      }
      await visit();
    };
    await visit();
    return result;
  };

  return {
    pluginsMeta,
    activePlugins,
    pushPlugin,
    getHookFunction,
    callHook,
    callAsyncHook,

    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,

    getLastPluginUsed: () => lastPluginUsed,
    getCurrentPlugin: () => currentPlugin,
    getCurrentHookName: () => currentHookName,
  };
};

const getHookFunction = (
  hook,
  // can be undefined, reference, or urlInfo
  info = {},
) => {
  const hookValue = hook.value;
  if (typeof hookValue === "object") {
    const hookForType = hookValue[info.type] || hookValue["*"];
    if (!hookForType) {
      return null;
    }
    return hookForType;
  }
  return hookValue;
};

const assertAndNormalizeReturnValue = (hook, returnValue, info) => {
  // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
  if (returnValue === null || returnValue === undefined) {
    return returnValue;
  }
  for (const returnValueAssertion of returnValueAssertions) {
    if (!returnValueAssertion.appliesTo.includes(hook.name)) {
      continue;
    }
    const assertionResult = returnValueAssertion.assertion(returnValue, info, {
      hook,
    });
    if (assertionResult !== undefined) {
      // normalization
      returnValue = assertionResult;
      break;
    }
  }
  return returnValue;
};

const returnValueAssertions = [
  {
    name: "url_assertion",
    appliesTo: ["resolveReference", "redirectReference"],
    assertion: (valueReturned, urlInfo, { hook }) => {
      if (valueReturned instanceof URL) {
        return valueReturned.href;
      }
      if (typeof valueReturned === "string") {
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by "${hook.plugin.name}" plugin: it must be a string; got ${valueReturned}`,
      );
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
    assertion: (valueReturned, urlInfo, { hook }) => {
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        return { content: valueReturned };
      }
      if (typeof valueReturned === "object") {
        const { content, body } = valueReturned;
        if (urlInfo.url.startsWith("ignore:")) {
          return undefined;
        }
        if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
          throw new Error(
            `Unexpected "content" returned by "${hook.plugin.name}" ${hook.name} hook: it must be a string or a buffer; got ${content}`,
          );
        }
        return undefined;
      }
      throw new Error(
        `Unexpected value returned by "${hook.plugin.name}" ${hook.name} hook: it must be a string, a buffer or an object; got ${valueReturned}`,
      );
    },
  },
];
