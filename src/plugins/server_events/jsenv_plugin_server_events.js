/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { ServerEvents } from "@jsenv/server";

const serverEventsClientFileUrl = new URL(
  "./client/server_events_client.js",
  import.meta.url,
).href;

export const jsenvPluginServerEvents = ({ clientAutoreload }) => {
  let serverEvents = new ServerEvents({
    actionOnClientLimitReached: "kick-oldest",
  });
  const { clientServerEventsConfig } = clientAutoreload;
  const { logs = true } = clientServerEventsConfig;

  return {
    name: "jsenv:server_events",
    appliesDuring: "dev",
    effect: ({ kitchenContext, otherPlugins }) => {
      const allServerEvents = {};
      for (const otherPlugin of otherPlugins) {
        const { serverEvents } = otherPlugin;
        if (!serverEvents) {
          continue;
        }
        for (const serverEventName of Object.keys(serverEvents)) {
          // we could throw on serverEvent name conflict
          // we could throw if serverEvents[serverEventName] is not a function
          allServerEvents[serverEventName] = serverEvents[serverEventName];
        }
      }
      const serverEventNames = Object.keys(allServerEvents);
      if (serverEventNames.length === 0) {
        return false;
      }

      const onabort = () => {
        serverEvents.close();
      };
      kitchenContext.signal.addEventListener("abort", onabort);
      for (const serverEventName of Object.keys(allServerEvents)) {
        const serverEventInfo = {
          ...kitchenContext,
          // serverEventsDispatcher variable is safe, we can disable esling warning
          // eslint-disable-next-line no-loop-func
          sendServerEvent: (data) => {
            if (!serverEvents) {
              // this can happen if a plugin wants to send a server event but
              // server is closing or the plugin got destroyed but still wants to do things
              // if plugin code is correctly written it is never supposed to happen
              // because it means a plugin is still trying to do stuff after being destroyed
              return;
            }
            serverEvents.sendEventToAllClients({
              type: serverEventName,
              data,
            });
          },
        };
        const serverEventInit = allServerEvents[serverEventName];
        serverEventInit(serverEventInfo);
      }
      return () => {
        kitchenContext.signal.removeEventListener("abort", onabort);
        serverEvents.close();
        serverEvents = undefined;
      };
    },
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        injectJsenvScript(htmlAst, {
          src: serverEventsClientFileUrl,
          initCall: {
            callee: "window.__server_events__.setup",
            params: {
              logs,
            },
          },
          pluginName: "jsenv:server_events",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
    devServerRoutes: [
      {
        endpoint: "GET /.internal/events.websocket",
        description: `Jsenv dev server emit server events on this endpoint. When a file is saved the "reload" event is sent here.`,
        fetch: serverEvents.fetch,
      },
    ],
  };
};
