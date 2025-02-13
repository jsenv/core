// TODO: add a CLI lik npx @jsenv/mp-up file, file

import { findHtmlNode, getHtmlNodeAttribute } from "@jsenv/ast";
import { existsSync } from "node:fs";
import { mdAsHtml } from "./md_as_html.js";

export const lintMarkdown = (mdContent, mdUrl) => {
  const htmlTree = mdAsHtml(mdContent, mdUrl);
  findHtmlNode(htmlTree, (node) => {
    if (node.nodeName !== "a") {
      return;
    }
    const href = getHtmlNodeAttribute(node, "href");
    const urlObject = new URL(href, mdUrl);
    const url = urlObject.href;
    if (!url.startsWith("file://")) {
      return;
    }
    if (!existsSync(urlObject)) {
      console.warn(`dead link "${href}" in ${mdUrl}`);
    }
  });
};
