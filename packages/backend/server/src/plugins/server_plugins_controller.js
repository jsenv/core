import { createPluginsController } from "../plugins_controller.js";

// The hooks a server plugin can implement, in the order they run for a
// request. See docs/plugins.md for what each one is meant for.
const SERVER_PLUGIN_PROPERTIES = {
  // ({ port }) once the server listens
  serverListening: { type: "hook" },
  // (request) => { resource | pathname, ...requestProperties } | null
  redirectRequest: { type: "hook" },
  // async (request, helpers) => { ...helpersToAdd } | null
  augmentRouteFetchSecondArg: { type: "hook" },
  // async (request) => ["permission", ...] | null, called lazily and at most
  // once per request when a route declares permissions
  grantPermissions: { type: "hook" },
  // async (error, { request }) => response | null
  handleError: { type: "hook" },
  // (request, { response, warn }) to look at the response before it is sent
  inspectResponse: { type: "hook" },
  // (request, response) => responseToCompose | null
  injectResponseProperties: { type: "hook" },
  // ({ reason }) once the server is stopped
  serverStopped: { type: "hook" },
  // route descriptors, appended after the routes given to startServer
  routes: {},
};

export const createServerPluginsController = async (serverPlugins) => {
  const serverPluginsController = await createPluginsController({
    plugins: serverPlugins,
    pluginDescription: {
      name: "server plugin",
      properties: SERVER_PLUGIN_PROPERTIES,
    },
  });
  return serverPluginsController;
};
