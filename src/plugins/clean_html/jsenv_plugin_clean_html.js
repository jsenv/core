import { parseHtml, stringifyHtmlAst } from "@jsenv/ast";

export const jsenvPluginCleanHTML = () => {
  return {
    name: "jsenv:cleanup_html_during_dev",
    appliesDuring: "dev",
    finalizeUrlContent: {
      html: (urlInfo) => {
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        return stringifyHtmlAst(htmlAst, {
          cleanupPositionAttributes: true,
        });
      },
    },
  };
};
