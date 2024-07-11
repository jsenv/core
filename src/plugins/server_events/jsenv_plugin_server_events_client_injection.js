/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

const serverEventsClientFileUrl = new URL(
  "./client/server_events_client.js",
  import.meta.url,
).href;

export const jsenvPluginServerEventsClientInjection = ({ logs = true }) => {
  return {
    name: "jsenv:server_events_client_injection",
    appliesDuring: "*",
    transformUrlContent: {
      html: (urlInfo) => {
        // "unshift" so that event source client connection can be put as early as possible in html
        urlInfo.scriptInjections.unshift({
          src: serverEventsClientFileUrl,
          setup: {
            name: "window.__server_events__.setup",
            param: {
              logs,
            },
          },
          pluginName: "jsenv:server_events_client_injection",
        });
      },
    },
  };
};
