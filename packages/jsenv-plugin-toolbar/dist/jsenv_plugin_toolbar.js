import { parseHtmlString, injectScriptNodeAsEarlyAsPossible, createHtmlNode, stringifyHtmlAst } from "@jsenv/ast";

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
    transformUrlContent: {
      html: (urlInfo, context) => {
        if (urlInfo.url.startsWith(toolbarHtmlClientFileUrl)) {
          urlInfo.data.isJsenvToolbar = true;
          return null;
        }
        const htmlAst = parseHtmlString(urlInfo.content);
        const [toolbarInjectorReference] = context.referenceUtils.inject({
          type: "js_import",
          expectedType: "js_module",
          specifier: toolbarInjectorClientFileUrl
        });
        const [toolbarClientFileReference] = context.referenceUtils.inject({
          type: "iframe_src",
          expectedType: "html",
          specifier: toolbarHtmlClientFileUrl
        });
        injectScriptNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
          tagName: "script",
          type: "module",
          textContent: `
import { injectToolbar } from ${toolbarInjectorReference.generatedSpecifier}
injectToolbar(${JSON.stringify({
            toolbarUrl: toolbarClientFileReference.generatedSpecifier,
            logLevel,
            theme,
            opened,
            autoreload,
            animationsEnabled,
            notificationsEnabled
          }, null, "  ")})`
        }), "jsenv:toolbar");
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};

export { jsenvPluginToolbar };