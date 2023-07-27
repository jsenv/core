import {
  generateInlineContentUrl,
  injectQueryParams,
  urlToExtension,
} from "@jsenv/urls";

import { getHtmlNodeAttribute } from "./html_node_attributes.js";
import { getHtmlNodePosition } from "./html_node_position.js";
import { analyzeScriptNode } from "./html_analysis.js";

export const getUrlForContentInsideHtml = (node, { url }) => {
  let externalSpecifierAttributeName;
  let extension;
  if (node.nodeName === "script") {
    externalSpecifierAttributeName = "inlined-from-src";
    const scriptAnalysisResult = analyzeScriptNode(node);
    extension = scriptAnalysisResult.extension;
  } else if (node.nodeName === "style") {
    externalSpecifierAttributeName = "inlined-from-href";
    extension = ".css";
  } else if (node.nodeName === "link") {
    extension = urlToExtension(url);
  }

  if (externalSpecifierAttributeName) {
    const externalSpecifier = getHtmlNodeAttribute(
      node,
      externalSpecifierAttributeName,
    );
    if (externalSpecifier) {
      const inlineContentUrl = injectQueryParams(externalSpecifier, {
        inline: "",
      });
      return inlineContentUrl;
    }
  }
  const { line, column, lineEnd, columnEnd } = getHtmlNodePosition(node, {
    preferOriginal: true,
  });
  const inlineContentUrl = generateInlineContentUrl({
    url,
    extension,
    line,
    column,
    lineEnd,
    columnEnd,
  });
  return inlineContentUrl;
};
