import {
  parseHtmlString,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast";

export const jsenvPluginAutoreloadClient = () => {
  const autoreloadClientFileUrl = new URL(
    "./client/autoreload.js",
    import.meta.url,
  ).href;

  return {
    name: "jsenv:autoreload_client",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content);
        const [autoreloadClientReference] = context.referenceUtils.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        });
        injectHtmlNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: autoreloadClientReference.generatedSpecifier,
          }),
          "jsenv:autoreload_client",
        );
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};
