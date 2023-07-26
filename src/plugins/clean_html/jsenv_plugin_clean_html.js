import { parseHtmlString, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginCleanHTML = () => {
  return {
    name: "jsenv:cleanup_html_during_dev",
    appliesDuring: "dev",
    finalizeUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: true,
        });
      },
    },
  };
};
