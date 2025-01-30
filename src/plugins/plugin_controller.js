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

  const activeEffectSet = new Set();
  const pluginCandidateSet = new Set();
  const activePluginSet = new Set();
  // precompute a list of hooks per hookName for one major reason:
  // - When debugging, there is less iteration
  // also it should increase perf as there is less work to do
  const hookGroups = {};
  const addPlugin = (plugin, { position = "end" }) => {
    if (Array.isArray(plugin)) {
      if (position === "start") {
        plugin = plugin.slice().reverse();
      }
      for (const value of plugin) {
        addPlugin(value, { position });
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
    pluginCandidateSet.add(plugin);
    for (const key of Object.keys(plugin)) {
      if (key === "meta") {
        const value = plugin[key];
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
        console.warn(`Unexpected "${key}" property on "${plugin.name}" plugin`);
        continue;
      }
      const hookName = key;
      const hookValue = plugin[hookName];
      if (hookValue) {
        const group = hookGroups[hookName] || (hookGroups[hookName] = []);
        const hook = {
          plugin,
          name: hookName,
          value: hookValue,
        };
        if (position === "start") {
          let i = 0;
          while (i < group.length) {
            const before = group[i];
            if (!before.plugin.mustStayFirst) {
              break;
            }
            i++;
          }
          group.splice(i, 0, hook);
        } else {
          group.push(hook);
        }
      }
    }
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
      addPlugin(arg, { position: "end" });
    }
    updateActivePlugins();
  };
  const unshiftPlugin = (...args) => {
    for (const arg of args) {
      addPlugin(arg, { position: "start" });
    }
    updateActivePlugins();
  };
  const updateActivePlugins = () => {
    for (const { plugin, cleanup } of activeEffectSet) {
      cleanup();
      activePluginSet.delete(plugin);
    }
    activeEffectSet.clear();
    // consider all plugin with effects as unactive
    for (const pluginCandidate of pluginCandidateSet) {
      const effect = pluginCandidate.effect;
      if (!effect) {
        activePluginSet.add(pluginCandidate);
        continue;
      }
      const returnValue = effect({
        kitchenContext,
        activePluginSet,
      });
      if (!returnValue) {
        continue;
      }
      activePluginSet.add(pluginCandidate);
      activeEffectSet.add({
        plugin: pluginCandidate,
        cleanup: typeof returnValue === "function" ? returnValue : () => {},
      });
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
    const hooks = hookGroups[hookName];
    if (hooks) {
      const setHookParams = (firstArg = info) => {
        info = firstArg;
      };
      for (const hook of hooks) {
        const returnValue = callHook(hook, info);
        if (returnValue && callback) {
          callback(returnValue, hook.plugin, setHookParams);
        }
      }
    }
  };
  const callAsyncHooks = async (hookName, info, callback, options) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = await callAsyncHook(hook, info, options);
        if (returnValue && callback) {
          await callback(returnValue, hook.plugin);
        }
      }
    }
  };

  const callHooksUntil = (hookName, info) => {
    const hooks = hookGroups[hookName];
    if (hooks) {
      for (const hook of hooks) {
        const returnValue = callHook(hook, info);
        if (returnValue) {
          return returnValue;
        }
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, options) => {
    const hooks = hookGroups[hookName];
    if (!hooks) {
      return null;
    }
    if (hooks.length === 0) {
      return null;
    }
    let result;
    let index = 0;
    const visit = async () => {
      if (index >= hooks.length) {
        return;
      }
      const hook = hooks[index];
      const returnValue = await callAsyncHook(hook, info, options);
      if (returnValue) {
        result = returnValue;
        return;
      }
      index++;
      await visit();
    };
    await visit(0);
    return result;
  };

  return {
    pluginsMeta,
    activePluginSet,
    pushPlugin,
    unshiftPlugin,
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
