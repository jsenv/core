import { createPluginsController } from "../plugins_controller.js";

export const createServerPluginsController = async (serverPlugins) => {
  const jsenvServerPluginsController = await createPluginsController({
    plugins: serverPlugins,
    pluginDescription: {
      name: "server plugin",
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
  return jsenvServerPluginsController;
};
