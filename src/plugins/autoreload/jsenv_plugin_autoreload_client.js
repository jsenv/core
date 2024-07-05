import {
  parseHtml,
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
      html: (htmlUrlInfo) => {
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const autoreloadClientReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        });
        const paramsJson = JSON.stringify(
          {
            mainFilePath: `/${htmlUrlInfo.kitchen.context.mainFilePath}`,
          },
          null,
          "  ",
        );
        injectHtmlNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            textContent: `import { initAutoreload } from "${autoreloadClientReference.generatedSpecifier}";

initAutoreload(${paramsJson});`,
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
