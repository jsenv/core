import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginDropToOpen = () => {
  const clientFileUrl = import.meta.resolve("./client/drop_to_open.js");
  return {
    name: "jsenv:drop_to_open",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const clientFileReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: clientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: clientFileReference.generatedSpecifier,
          initCall: {
            callee: "initDropToOpen",
            params: {
              rootDirectoryUrl: urlInfo.context.rootDirectoryUrl,
            },
          },
          pluginName: "jsenv:drop_to_open",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
