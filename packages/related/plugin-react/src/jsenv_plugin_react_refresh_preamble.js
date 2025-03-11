import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginReactRefreshPreamble = () => {
  const reactRefreshPreambleClientFileUrl = new URL(
    "./client/react_refresh_preamble.js",
    import.meta.url,
  ).href;

  return {
    name: "jsenv:react_refresh_preamble",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const jsenvToolbarHtmlClientFileUrl = urlInfo.context.getPluginMeta(
          "jsenvToolbarHtmlClientFileUrl",
        );
        if (
          jsenvToolbarHtmlClientFileUrl &&
          // startsWith to ignore search params
          urlInfo.url.startsWith(jsenvToolbarHtmlClientFileUrl)
        ) {
          return null;
        }
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const reactRefreshPreambleReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: reactRefreshPreambleClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: reactRefreshPreambleReference.generatedSpecifier,
          pluginName: "jsenv:react_refresh_preamble",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      },
    },
  };
};
