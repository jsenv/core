import { createPluginsController } from "@jsenv/server/src/plugins_controller.js";

import { jsenvPluginHtmlSyntaxErrorFallback } from "./html_syntax_error_fallback/jsenv_plugin_html_syntax_error_fallback.js";

export const createJsenvPluginStore = async (plugins) => {
  const allServerRoutes = [];
  const allServerPlugins = [];
  const pluginArray = [];

  const pluginPromises = [];
  const addPlugin = async (plugin) => {
    if (plugin && typeof plugin.then === "function") {
      pluginPromises.push(plugin);
      const value = await plugin;
      addPlugin(value);
      return;
    }
    if (Array.isArray(plugin)) {
      for (const subplugin of plugin) {
        addPlugin(subplugin);
      }
      return;
    }
    if (plugin === null || typeof plugin !== "object") {
      throw new TypeError(`plugin must be objects, got ${plugin}`);
    }
    if (!plugin.name) {
      plugin.name = "anonymous";
    }
    const { serverRoutes } = plugin;
    if (serverRoutes) {
      for (const serverRoute of serverRoutes) {
        allServerRoutes.push(serverRoute);
      }
    }
    const { serverPlugins } = plugin;
    if (serverPlugins) {
      const serverPlugins = plugin.serverPlugins;
      for (const serverPlugin of serverPlugins) {
        allServerPlugins.push(serverPlugin);
      }
    }
    pluginArray.push(plugin);
  };
  addPlugin(jsenvPluginHtmlSyntaxErrorFallback());
  for (const plugin of plugins) {
    addPlugin(plugin);
  }
  await Promise.all(pluginPromises);

  return {
    pluginArray,
    allServerRoutes,
    allServerPlugins,
  };
};

export const createJsenvPluginsController = async (
  pluginStore,
  kitchen,
  { meta } = {},
) => {
  kitchen.context.getPluginMeta = (id) => pluginsController.getPluginMeta(id);
  const pluginsController = await createPluginsController({
    plugins: pluginStore.pluginArray,
    pluginDescription: JSENV_PLUGIN_DESCRIPTION,
    filterPlugin: (plugin) => testAppliesDuring(plugin, kitchen),
    getInitPluginArgs: (plugin) => [kitchen.context, { plugin }],
    getEffectArgs: ({ otherPlugins }) => [
      { kitchenContext: kitchen.context, otherPlugins },
    ],
    meta,
  });
  return pluginsController;
};

const hook = { type: "hook" };
const nonHook = {};

const assertUrlReturnValue = (valueReturned, urlInfo, { hook }) => {
  if (valueReturned instanceof URL) {
    return valueReturned.href;
  }
  if (typeof valueReturned === "string") {
    return valueReturned;
  }
  throw new Error(
    `Unexpected value returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string; got ${valueReturned}`,
  );
};
const assertContentReturnValue = (valueReturned, urlInfo, { hook }) => {
  if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
    return { content: valueReturned };
  }
  if (typeof valueReturned === "object") {
    const { content, body } = valueReturned;
    if (urlInfo.url.startsWith("ignore:")) {
      return valueReturned;
    }
    if (typeof content !== "string" && !Buffer.isBuffer(content) && !body) {
      if (Object.hasOwn(valueReturned, "contentInjections")) {
        return valueReturned;
      }
      throw new Error(
        `Unexpected "content" returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string or a buffer; got ${content}`,
      );
    }
    return valueReturned;
  }
  throw new Error(
    `Unexpected value returned by hook "${hook.plugin.name}.${hook.name}()": it must be a string, a buffer or an object; got ${valueReturned}`,
  );
};

const JSENV_PLUGIN_DESCRIPTION = {
  name: "jsenv plugin",
  properties: {
    // non-hook properties (silently skipped)
    appliesDuring: nonHook,
    serverEvents: nonHook,
    mustStayFirst: nonHook,
    serverRoutes: nonHook,
    serverPlugins: nonHook,
    // hooks
    init: hook,
    resolveReference: {
      type: "hook",
      assertAndNormalize: assertUrlReturnValue,
    },
    redirectReference: {
      type: "hook",
      assertAndNormalize: assertUrlReturnValue,
    },
    transformReferenceSearchParams: hook,
    formatReference: hook,
    urlInfoCreated: hook,
    fetchUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    transformUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    finalizeUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    bundle: hook,
    optimizeBuildUrlContent: {
      type: "hook",
      assertAndNormalize: assertContentReturnValue,
    },
    cooked: hook,
    augmentResponse: hook,
    destroy: hook,
    effect: hook,
    refineBuildUrlContent: hook,
    refineBuild: hook,
    // serverRoutes and serverPlugins are nonHook above
  },
};

const testAppliesDuring = (plugin, kitchen) => {
  const { appliesDuring } = plugin;
  if (appliesDuring === undefined) {
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
    if (kitchen.context[appliesDuring]) {
      return true;
    }
    return false;
  }
  if (typeof appliesDuring === "object") {
    for (const key of Object.keys(appliesDuring)) {
      if (!appliesDuring[key] && kitchen.context[key]) {
        return false;
      }
      if (appliesDuring[key] && kitchen.context[key]) {
        return true;
      }
    }
    return false;
  }
  throw new TypeError(
    `"appliesDuring" must be an object or a string, got ${appliesDuring}`,
  );
};
