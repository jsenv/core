import {
  parseHtmlString,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast";

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
        if (urlInfo.data.isJsenvToolbar) {
          return null;
        }
        const htmlAst = parseHtmlString(urlInfo.content);
        const reactRefreshPreambleReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: reactRefreshPreambleClientFileUrl,
        });
        injectHtmlNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: reactRefreshPreambleReference.generatedSpecifier,
          }),
          "jsenv:react_refresh_preamble",
        );
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      },
    },
  };
};
