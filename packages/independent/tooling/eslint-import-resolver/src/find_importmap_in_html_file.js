import { analyzeScriptNode } from "@jsenv/ast/src/html/html_analysis.js";
import { getHtmlNodeAttribute } from "@jsenv/ast/src/html/html_node_attributes.js";
import { getHtmlNodeText } from "@jsenv/ast/src/html/html_node_text.js";
import { parseHtml } from "@jsenv/ast/src/html/html_parse.js";
import { findHtmlNode } from "@jsenv/ast/src/html/html_search.js";
import { normalizeImportMap } from "@jsenv/importmap";
import { readFileSync } from "node:fs";
import { readImportmapFromFile } from "./read_importmap.js";

export const parseHtmlForImportmap = (htmlFileUrl) => {
  const htmlFileContent = readFileSync(new URL(htmlFileUrl), "utf8");
  const htmlAst = parseHtml({
    html: htmlFileContent,
    url: htmlFileUrl,
  });
  const importmapNode = findHtmlNode(htmlAst, (node) => {
    if (node.nodeName !== "script") {
      return false;
    }
    const { type } = analyzeScriptNode(node);
    if (type === "importmap") {
      return node;
    }
    return false;
  });
  if (!importmapNode) {
    return null;
  }

  const src = getHtmlNodeAttribute(importmapNode, "src");
  if (src) {
    const importmapFileUrl = new URL(src, htmlFileUrl).href;
    if (importmapFileUrl.protocol !== "file:") {
      // we don't support importmap loaded from http for now
      return null;
    }
    const importmap = readImportmapFromFile(importmapFileUrl);
    return importmap;
  }
  const htmlNodeText = getHtmlNodeText(importmapNode);
  if (!htmlNodeText) {
    return null;
  }
  const importmap = JSON.parse(htmlNodeText);
  return normalizeImportMap(importmap, htmlFileUrl);
};
