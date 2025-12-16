import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginAutoreloadOnServerRestart = () => {
  const autoreloadOnRestartClientFileUrl = import.meta
    .resolve("@jsenv/server/src/services/autoreload_on_server_restart/client/autoreload_on_server_restart.js");

  return {
    name: "jsenv:autoreload_on_server_restart",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        // we should not do this for inspector and 4xx.html
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const autoreloadOnRestartClientFileReference =
          urlInfo.dependencies.inject({
            type: "script",
            subtype: "js_classic",
            expectedType: "js_classic",
            specifier: autoreloadOnRestartClientFileUrl,
          });
        injectJsenvScript(htmlAst, {
          "src": autoreloadOnRestartClientFileReference.generatedSpecifier,
          "pluginName": "jsenv:autoreload_on_server_restart",
          "data-ws-endpoint": "/.internal/events.websocket",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
