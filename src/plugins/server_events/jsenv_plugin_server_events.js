/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { createServerEventsDispatcher } from "./server_events_dispatcher.js";

const serverEventsClientFileUrl = new URL(
  "./client/server_events_client.js",
  import.meta.url,
).href;

export const jsenvPluginServerEvents = ({ clientAutoreload }) => {
  let serverEventsDispatcher;

  return {
    name: "jsenv:server_events",
    appliesDuring: "dev",
    effect: ({ kitchenContext, activePluginSet }) => {
      const allServerEvents = {};
      for (const plugin of activePluginSet) {
        const { serverEvents } = plugin;
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
        serverEventsDispatcher.destroy();
      };
      kitchenContext.signal.addEventListener("abort", onabort);
      serverEventsDispatcher = createServerEventsDispatcher();
      Object.keys(allServerEvents).forEach((serverEventName) => {
        const serverEventInfo = {
          ...kitchenContext,
          sendServerEvent: (data) => {
            serverEventsDispatcher.dispatch({
              type: serverEventName,
              data,
            });
          },
        };
        const serverEventInit = allServerEvents[serverEventName];
        serverEventInit(serverEventInfo);
      });
      return () => {
        kitchenContext.signal.removeEventListener("abort", onabort);
        serverEventsDispatcher.destroy();
        serverEventsDispatcher = undefined;
      };
    },
    handleWebsocket: async (websocket, { request }) => {
      if (request.headers["sec-websocket-protocol"] !== "jsenv") {
        return false;
      }
      serverEventsDispatcher.addWebsocket(websocket, request);
      return true;
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
              logs: clientAutoreload.logs,
            },
          },
          pluginName: "jsenv:server_events",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
