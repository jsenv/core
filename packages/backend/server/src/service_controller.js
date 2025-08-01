const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "augmentRouteFetchSecondArg",
  "routes",
  "handleError",
  "onResponsePush",
  "injectResponseProperties",
  "serverStopped",
];

export const createServiceController = (services) => {
  const hookSetMap = new Map();

  const addHook = (hook) => {
    let hookSet = hookSetMap.get(hook.name);
    if (!hookSet) {
      hookSet = new Set();
      hookSetMap.set(hook.name, hookSet);
    }
    hookSet.add(hook);
  };

  const addService = (service) => {
    for (const key of Object.keys(service)) {
      if (key === "name") continue;
      const isHook = HOOK_NAMES.includes(key);
      if (!isHook) {
        console.warn(
          `Unexpected "${key}" property on "${service.name}" service`,
        );
      }
      const hookName = key;
      const hookValue = service[hookName];
      if (!hookValue) {
        continue;
      }
      if (hookName === "routes") {
      } else {
        addHook({
          service,
          name: hookName,
          value: hookValue,
        });
      }
    }
  };

  for (const service of services) {
    addService(service);
  }

  let currentService = null;
  let currentHookName = null;
  const callHook = (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let valueReturned = hookFn(info, context);
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };
  const callAsyncHook = async (hook, info, context) => {
    const hookFn = getHookFunction(hook, info);
    if (!hookFn) {
      return null;
    }
    currentService = hook.service;
    currentHookName = hook.name;
    let valueReturned = await hookFn(info, context);
    currentService = null;
    currentHookName = null;
    return valueReturned;
  };

  const callHooks = (hookName, info, context, callback = () => {}) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      if (returnValue) {
        callback(returnValue);
      }
    }
  };
  const callAsyncHooks = async (hookName, info, context, callback) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return;
    }
    for (const hook of hookSet) {
      const returnValue = await callAsyncHook(hook, info, context);
      if (returnValue && callback) {
        await callback(returnValue, hook.plugin);
      }
    }
  };
  const callHooksUntil = (
    hookName,
    info,
    context,
    until = (returnValue) => returnValue,
  ) => {
    const hookSet = hookSetMap.get(hookName);
    if (!hookSet) {
      return null;
    }
    for (const hook of hookSet) {
      const returnValue = callHook(hook, info, context);
      const untilReturnValue = until(returnValue);
      if (untilReturnValue) {
        return untilReturnValue;
      }
    }
    return null;
  };
  const callAsyncHooksUntil = async (hookName, info, context) => {
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
      const returnValue = await callAsyncHook(hook, info, context);
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
    services,

    callHooks,
    callHooksUntil,
    callAsyncHooks,
    callAsyncHooksUntil,

    getCurrentService: () => currentService,
    getCurrentHookName: () => currentHookName,
  };
};

const getHookFunction = (hook, info) => {
  const hookValue = hook.value;
  if (hook.name === "handleRequest" && typeof hookValue === "object") {
    const request = info;
    const hookForMethod = hookValue[request.method] || hookValue["*"];
    if (!hookForMethod) {
      return null;
    }
    return hookForMethod;
  }
  return hookValue;
};

export const flattenAndFilterServices = (services) => {
  const flatServices = [];
  const visitServiceEntry = (serviceEntry) => {
    if (Array.isArray(serviceEntry)) {
      serviceEntry.forEach((value) => visitServiceEntry(value));
      return;
    }
    if (typeof serviceEntry === "object" && serviceEntry !== null) {
      if (!serviceEntry.name) {
        serviceEntry.name = "anonymous";
      }
      flatServices.push(serviceEntry);
      return;
    }
    throw new Error(`services must be objects, got ${serviceEntry}`);
  };
  services.forEach((serviceEntry) => visitServiceEntry(serviceEntry));
  return flatServices;
};
