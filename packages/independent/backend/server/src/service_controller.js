import { jsenvServiceRouting } from "./router/jsenv_service_routing.js";
import { timeStart } from "./server_timing/timing_measure.js";
import { jsenvServiceAutoreloadOnRestart } from "./services/autoreload_on_server_restart/jsenv_service_autoreload_on_server_restart.js";
import { jsenvServiceInternalClientFiles } from "./services/internal_client_files/jsenv_service_internal_client_files.js";

const HOOK_NAMES = [
  "serverListening",
  "redirectRequest",
  "handleRequest",
  "routes",
  "handleWebsocket",
  "handleError",
  "onResponsePush",
  "injectResponseHeaders",
  "responseReady",
  "serverStopped",
];

export const createServiceController = (services, { routesFromParam }) => {
  const flatServices = [
    jsenvServiceInternalClientFiles(),
    jsenvServiceAutoreloadOnRestart(),
    ...flattenAndFilterServices(services),
  ];
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

  const routes = [...routesFromParam];
  for (const flatService of flatServices) {
    const serviceRoutes = flatService.routes;
    if (serviceRoutes) {
      routes.push(...serviceRoutes);
    }
  }
  flatServices.unshift(jsenvServiceRouting(routes));
  for (const flatService of flatServices) {
    addService(flatService);
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
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
    }
    let valueReturned = hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
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
    let timeEnd;
    if (context && context.timing) {
      timeEnd = timeStart(
        `${currentService.name.replace("jsenv:", "")}.${currentHookName}`,
      );
    }
    let valueReturned = await hookFn(info, context);
    if (context && context.timing) {
      Object.assign(context.timing, timeEnd());
    }
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
    services: flatServices,

    callHooks,
    callHooksUntil,
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

const flattenAndFilterServices = (services) => {
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
