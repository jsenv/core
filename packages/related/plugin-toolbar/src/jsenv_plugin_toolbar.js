import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginToolbar = ({
  logLevel = "warn",
  theme = "dark",
  opened = false,
  autoreload = true,
  animationsEnabled = true,
  notificationsEnabled = true,
} = {}) => {
  const toolbarInjectorClientFileUrl = import.meta
    .resolve("./client/toolbar_injector.js");
  const toolbarHtmlClientFileUrl = import.meta.resolve("./client/toolbar.html");
  return {
    name: "jsenv:toolbar",
    appliesDuring: "dev",
    meta: {
      jsenvToolbarHtmlClientFileUrl: toolbarHtmlClientFileUrl,
    },
    transformUrlContent: {
      html: (urlInfo) => {
        if (urlInfo.url.startsWith(toolbarHtmlClientFileUrl)) {
          return null;
        }
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const toolbarInjectorReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: toolbarInjectorClientFileUrl,
        });
        const toolbarClientFileReference = urlInfo.dependencies.inject({
          type: "iframe_src",
          expectedType: "html",
          specifier: toolbarHtmlClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: toolbarInjectorReference.generatedSpecifier,
          initCall: {
            callee: "injectToolbar",
            params: {
              toolbarUrl: toolbarClientFileReference.generatedSpecifier,
              logLevel,
              theme,
              opened,
              autoreload,
              animationsEnabled,
              notificationsEnabled,
            },
          },
          pluginName: "jsenv:toolbar",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};
