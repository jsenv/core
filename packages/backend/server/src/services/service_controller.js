import { createPluginsController } from "../plugins_controller.js";

export const createServiceController = async (services) => {
  const controller = await createPluginsController({
    plugins: services,
    pluginDescription: {
      name: "service",
      properties: {
        serverListening: { type: "hook" },
        redirectRequest: { type: "hook" },
        augmentRouteFetchSecondArg: { type: "hook" },
        handleError: { type: "hook" },
        onResponsePush: { type: "hook" },
        injectResponseProperties: { type: "hook" },
        serverStopped: { type: "hook" },
        routes: {}, // routes are handled separately (used to populate the router)
      },
    },
  });

  return {
    services: controller.activePlugins,

    callHooks: controller.callHooks,
    callHooksUntil: controller.callHooksUntil,
    callAsyncHooks: controller.callAsyncHooks,
    callAsyncHooksUntil: controller.callAsyncHooksUntil,

    getCurrentService: controller.getCurrentPlugin,
    getCurrentHookName: controller.getCurrentHookName,
  };
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
