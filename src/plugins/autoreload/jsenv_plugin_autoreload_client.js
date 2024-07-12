import { parseHtml, injectJsenvScript, stringifyHtmlAst } from "@jsenv/ast";

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
          type: "js_import",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: autoreloadClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: autoreloadClientReference.generatedSpecifier,
          initCall: {
            callee: "initAutoreload",
            params: {
              mainFilePath: `/${htmlUrlInfo.kitchen.context.mainFilePath}`,
            },
          },
          pluginName: "jsenv:autoreload_client",
        });
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};
