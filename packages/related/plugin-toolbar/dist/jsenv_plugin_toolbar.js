import { parseHtml, injectJsenvScript, stringifyHtmlAst } from "@jsenv/ast";

const jsenvPluginToolbar = ({
  logLevel = "warn",
  theme = "dark",
  opened = false,
  autoreload = true,
  animationsEnabled = true,
  notificationsEnabled = true
} = {}) => {
  const toolbarInjectorClientFileUrl = new URL("./js/toolbar_injector.js", import.meta.url).href;
  const toolbarHtmlClientFileUrl = new URL("./html/toolbar.html", import.meta.url).href;
  return {
    name: "jsenv:toolbar",
    appliesDuring: "dev",
    meta: {
      jsenvToolbarHtmlClientFileUrl: toolbarHtmlClientFileUrl
    },
    transformUrlContent: {
      html: urlInfo => {
        if (urlInfo.url.startsWith(toolbarHtmlClientFileUrl)) {
          return null;
        }
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url
        });
        const toolbarInjectorReference = urlInfo.dependencies.inject({
          type: "js_import",
          expectedType: "js_module",
          specifier: toolbarInjectorClientFileUrl
        });
        const toolbarClientFileReference = urlInfo.dependencies.inject({
          type: "iframe_src",
          expectedType: "html",
          specifier: toolbarHtmlClientFileUrl
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
              notificationsEnabled
            }
          },
          pluginName: "jsenv:toolbar"
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

export { jsenvPluginToolbar };
