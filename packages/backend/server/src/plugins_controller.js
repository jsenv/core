import { performance } from "node:perf_hooks";

// createPluginsController manages an ordered list of plugins.
// "plugins" is a generic term: it can refer to jsenv core plugins,
// server plugins, or any extensibility mechanism using the same pattern.
export const createPluginsController = async ({
  plugins,
  pluginDescription = {},
  filterPlugin,
  getInitPluginArgs,
  getHookFunction = defaultGetHookFunction,
  getTimingKey = defaultGetTimingKey,
  getEffectArgs = defaultGetEffectArgs,
}) => {
  const { name: pluginName = "plugin", properties = {} } = pluginDescription;

  const hookSetMap = new Map();
  const meta = {};

  const addHook = (hook) => {
    let hookSet = hookSetMap.get(hook.name);
    if (!hookSet) {
      hookSet = new Set();
      hookSetMap.set(hook.name, hookSet);
    }
    hookSet.add(hook);
  };

  const addPluginToHookSetMap = (plugin) => {
    for (const key of Object.keys(plugin)) {
      if (
        key === "name" ||
        key === "init" ||
        key === "destroy" ||
        key === "meta" ||
        key === "effect"
      ) {
        continue;
      }
      const propDef = properties[key];
      if (propDef === undefined) {
        console.warn(
          `Unexpected "${key}" property on "${plugin.name}" ${pluginName}`,
        );
        continue;
      }
      if (propDef.type !== "hook") {
        // non-hook key, silently skip
        continue;
      }
      const hookValue = plugin[key];
      if (!hookValue) {
        continue;
      }
      addHook({
        plugin,
        name: key,
        value: hookValue,
      });
    }
  };

  const activatePlugin = (plugin) => {
    if (plugin.meta) {
      const value = plugin.meta;
      if (typeof value !== "object" || value === null) {
        console.warn(`${pluginName}.meta must be an object, got ${value}`);
      } else {
        Object.assign(meta, value);
        Object.freeze(value);
      }
    }
    addPluginToHookSetMap(plugin);
  };

  const pluginCandidates = plugins;
  const activePlugins = [];
  const pluginsWithEffect = [];

  for (const pluginCandidate of pluginCandidates) {
    if (filterPlugin && !filterPlugin(pluginCandidate)) {
      pluginCandidate.destroy?.();
      continue;
    }
    const active = await callInitOnPlugin(pluginCandidate, getInitPluginArgs);
    if (!active) {
      pluginCandidate.destroy?.();
      continue;
    }
    if (pluginCandidate.effect) {
      pluginsWithEffect.push(pluginCandidate);
    } else {
      activePlugins.push(pluginCandidate);
    }
  }

  for (const pluginWithEffect of pluginsWithEffect) {
    const effectArgs = getEffectArgs({ otherPlugins: activePlugins });
    const returnValue = pluginWithEffect.effect(...effectArgs);
    if (!returnValue) {
      continue;
    }
    activePlugins.push(pluginWithEffect);
    if (typeof returnValue === "function" && !pluginWithEffect.destroy) {
      pluginWithEffect.destroy = returnValue;
    }
  }

  // Preserve original declaration order
  activePlugins.sort(
    (a, b) => pluginCandidates.indexOf(a) - pluginCandidates.indexOf(b),
  );

  for (const activePlugin of activePlugins) {
    activatePlugin(activePlugin);
  }

  const assertAndNormalizeReturnValue = (valueReturned, info, { hook }) => {
    if (valueReturned === null || valueReturned === undefined) {
      // all hooks are allowed to return null/undefined as a signal of "I don't do anything"
      return valueReturned;
    }
    const propDef = properties[hook.name];
    if (!propDef || !propDef.assertAndNormalize) {
      return valueReturned;
    }
    const assertAndNormalizeResult = propDef.assertAndNormalize(
      valueReturned,
      info,
      { hook },
    );
    return assertAndNormalizeResult;
  };

  let lastPluginUsed = null;
  let currentPlugin = null;
  let currentHookName = null;

  const callHook = (hook, info, secondArg) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let startTimestamp;
    if (info && info.timing) {
      startTimestamp = performance.now();
    }
    let valueReturned = hookFn(info, secondArg);
    if (startTimestamp !== undefined) {
      info.timing[getTimingKey(hook)] = performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(valueReturned, info, {
      hook,
    });
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, secondArg) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    lastPluginUsed = hook.plugin;
    currentPlugin = hook.plugin;
    currentHookName = hook.name;
    let startTimestamp;
    if (info && info.timing) {
      startTimestamp = performance.now();
    }
    let valueReturned = await hookFn(info, secondArg);
    if (startTimestamp !== undefined) {
      info.timing[getTimingKey(hook)] = performance.now() - startTimestamp;
    }
    valueReturned = assertAndNormalizeReturnValue(valueReturned, info, {
      hook,
    });
    currentPlugin = null;
    currentHookName = null;
    return valueReturned;
  };
  // callHooks(hookName, info, callback)
  // callHooks(hookName, info, secondArg, callback)
  const callHooks = (hookName, info, secondArgOrCallback, callback) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    let secondArg;
    if (typeof secondArgOrCallback === "function") {
      callback = secondArgOrCallback;
      secondArg = undefined;
    } else {
      secondArg = secondArgOrCallback;
    }
    const setHookParams = (firstArg = info) => {
      info = firstArg;
    };
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, secondArg);
      if (returnValue && callback) {
        callback(returnValue, hook.plugin, setHookParams);
      }
    }
  };
  // callAsyncHooks(hookName, info, callback)
  // callAsyncHooks(hookName, info, secondArg, callback)
  const callAsyncHooks = async (
    hookName,
    info,
    secondArgOrCallback,
    callback,
  ) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    let secondArg;
    if (typeof secondArgOrCallback === "function") {
      callback = secondArgOrCallback;
      secondArg = undefined;
    } else {
      secondArg = secondArgOrCallback;
    }
    for (const hook of hookSet) {
      const returnValue = await callAsyncHook(hook, info, secondArg);
      if (returnValue && callback) {
        await callback(returnValue, hook.plugin);
      }
    }
  };
  // callHooksUntil(hookName, info)
  // callHooksUntil(hookName, info, secondArg)
  // callHooksUntil(hookName, info, secondArg, until)
  const callHooksUntil = (hookName, info, secondArgOrUntil, until) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    let secondArg;
    if (typeof secondArgOrUntil === "function") {
      until = secondArgOrUntil;
      secondArg = undefined;
    } else {
      secondArg = secondArgOrUntil;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, secondArg);
      if (until) {
        const untilValue = until(returnValue);
        if (untilValue) {
          return untilValue;
        }
      } else if (returnValue) {
        return returnValue;
      }
    }
    return null;
  };
  // callAsyncHooksUntil(hookName, info)
  // callAsyncHooksUntil(hookName, info, secondArg)
  const callAsyncHooksUntil = async (hookName, info, secondArg) => {
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
      const returnValue = await callAsyncHook(hook, info, secondArg);
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
    activePlugins,
    meta,
    hookSetMap,

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

const callInitOnPlugin = async (plugin, getInitPluginArgs) => {
  const { init } = plugin;
  if (!init) {
    return true;
  }
  const initArgs = getInitPluginArgs ? getInitPluginArgs(plugin) : [];
  const initReturnValue = await init(...initArgs);
  if (initReturnValue === false) {
    return false;
  }
  if (typeof initReturnValue === "function" && !plugin.destroy) {
    plugin.destroy = initReturnValue;
  }
  return true;
};

const defaultGetTimingKey = (hook) =>
  `${hook.name}-${hook.plugin.name.replace("jsenv:", "")}`;
const defaultGetEffectArgs = ({ otherPlugins }) => [{ otherPlugins }];

// By default, hook values can be a function or an object keyed by info.type.
// When an object, the hook for the matching type (or "*") is used.
const defaultGetHookFunction = (hook, info = {}) => {
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
