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
  // a node injected by jsenv has no place in the original html, so its position
  // is read in the generated one: a coordinate space the page own nodes are not
  // numbered in. Both spaces would mint the same url for different content.
  if (getHtmlNodeAttribute(node, "jsenv-injected-by")) {
    basename = "injected";
  }
  const { line, column, lineEnd, columnEnd } = getHtmlNodePosition(node, {
    preferOriginal: true,
  });
  let url;
  let htmlFileUrl = htmlUrlInfo.url;
  const originalHtmFilelUrl = htmlUrlInfo.originalUrl;
  if (originalHtmFilelUrl && originalHtmFilelUrl !== htmlFileUrl) {
    if (
      htmlUrlInfo.firstReference.type === "http_request" &&
      htmlUrlInfo.firstReference.original.url !== htmlFileUrl
    ) {
      // html got redirected because of spa navigation
      // we want to keep the original url as base for inline content
      url = htmlFileUrl;
    } else {
      url = originalHtmFilelUrl;
    }
  } else {
    url = htmlFileUrl;
  }
  const inlineContentUrl = generateUrlForInlineContent({
    url,
    basename,
    extension,
    line,
    column,
    lineEnd,
    columnEnd,
  });
  return inlineContentUrl;
};
