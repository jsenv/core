/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

import { parseHtml, injectJsenvScript, stringifyHtmlAst } from "@jsenv/ast";

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
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          src: serverEventsClientFileUrl,
          initCall: {
            callee: "window.__server_events__.setup",
            params: {
              logs,
            },
          },
          pluginName: "jsenv:server_events_client_injection",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
