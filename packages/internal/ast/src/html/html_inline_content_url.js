import { injectQueryParams, urlToBasename, urlToExtension } from "@jsenv/urls";

import { generateUrlForInlineContent } from "../inline_content_url.js";
import { analyzeScriptNode } from "./html_analysis.js";
import { getHtmlNodeAttribute } from "./html_node_attributes.js";
import { getHtmlNodePosition } from "./html_node_position.js";

export const getUrlForContentInsideHtml = (node, htmlUrlInfo, reference) => {
  let externalSpecifierAttributeName;
  let basename;
  let extension;

  if (node.nodeName === "script") {
    externalSpecifierAttributeName = "inlined-from-src";
    const scriptAnalysisResult = analyzeScriptNode(node);
    extension = scriptAnalysisResult.extension;
  } else if (node.nodeName === "style") {
    externalSpecifierAttributeName = "inlined-from-href";
    extension = ".css";
  } else if (node.nodeName === "link") {
    basename = urlToBasename(reference.url);
    extension = urlToExtension(reference.url);
  }

  if (externalSpecifierAttributeName) {
    const externalSpecifier = getHtmlNodeAttribute(
      node,
      externalSpecifierAttributeName,
    );
    if (externalSpecifier) {
      const inlineContentUrl = injectQueryParams(externalSpecifier, {
        inlined: "",
      });
      return inlineContentUrl;
    }
  }
  const { line, column, lineEnd, columnEnd } = getHtmlNodePosition(node, {
    preferOriginal: true,
  });
  const inlineContentUrl = generateUrlForInlineContent({
    url: htmlUrlInfo.originalUrl || htmlUrlInfo.url,
    basename,
    extension,
    line,
    column,
    lineEnd,
    columnEnd,
  });
  return inlineContentUrl;
};
