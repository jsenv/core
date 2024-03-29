import { parseHtml, injectHtmlNodeAsEarlyAsPossible, createHtmlNode, stringifyHtmlAst } from "@jsenv/ast";

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
        injectHtmlNodeAsEarlyAsPossible(htmlAst, createHtmlNode({
          tagName: "script",
          type: "module",
          textContent: generateCodeToInjectToolbar({
            toolbarInjectorReference,
            toolbarClientFileReference,
            logLevel,
            theme,
            opened,
            autoreload,
            animationsEnabled,
            notificationsEnabled
          })
        }), "jsenv:toolbar");
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified
        };
      }
    }
  };
};
const generateCodeToInjectToolbar = ({
  toolbarInjectorReference,
  toolbarClientFileReference,
  logLevel,
  theme,
  opened,
  autoreload,
  animationsEnabled,
  notificationsEnabled
}) => {
  const from = toolbarInjectorReference.generatedSpecifier;
  const paramsSource = JSON.stringify({
    toolbarUrl: toolbarClientFileReference.generatedSpecifier,
    logLevel,
    theme,
    opened,
    autoreload,
    animationsEnabled,
    notificationsEnabled
  }, null, "  ");
  return "import { injectToolbar } from ".concat(from, "\n\ninjectToolbar(").concat(paramsSource, ");");
};

export { jsenvPluginToolbar };
