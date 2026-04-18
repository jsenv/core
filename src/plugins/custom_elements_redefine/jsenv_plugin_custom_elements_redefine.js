import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginCustomElementsRedefine = () => {
  const customElementsRedefineClientFileUrl = import.meta
    .resolve("@jsenv/custom-elements-redefine/src/main.js");

  return {
    name: "jsenv:custom_elements_redefine",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        const reference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: customElementsRedefineClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: reference.generatedSpecifier,
          initCall: {
            callee: "allowCustomElementsRedefine",
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
