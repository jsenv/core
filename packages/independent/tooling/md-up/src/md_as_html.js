import { parseHtml } from "@jsenv/ast";
import { marked } from "marked";

export const mdAsHtml = (mdText, mdUrl) => {
  const mdAsHtml = marked.parse(mdText);
  // eslint-disable-next-line no-control-regex
  const mdSafe = mdAsHtml.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  const htmlTree = parseHtml({ html: mdSafe, url: mdUrl });
  return htmlTree;
};
