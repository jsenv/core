// TODO: reuse to inject versioning

import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
} from "@jsenv/ast";

export const prependContent = (urlInfoReceivingCode, urlInfoToPrepend) => {
  if (urlInfoReceivingCode.type === "html") {
    return prependContentInHtml(urlInfoReceivingCode, urlInfoToPrepend);
  }
  if (
    urlInfoReceivingCode.type === "js_module" ||
    urlInfoReceivingCode.type === "js_classic"
  ) {
    return prependContentInJs(urlInfoReceivingCode, urlInfoToPrepend);
  }
  // ideally we could for css as well
  // otherwise throw an error
  return null;
};

const prependContentInHtml = (htmlUrlInfo, urlInfoToPrepend) => {
  const htmlAst = parseHtmlString(htmlUrlInfo.content);
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      "tagName": "script",
      "textContent": urlInfoToPrepend.content,
      "inlined-from-src": urlInfoToPrepend.url,
    }),
    "jsenv:core",
  );
  const content = stringifyHtmlAst(htmlAst);
  return {
    content,
  };
};

const prependContentInJs = (jsUrlInfo, urlInfoToPrepend) => {
  const magicSource = createMagicSource(jsUrlInfo.content);
  magicSource.prepend(`${urlInfoToPrepend.content}\n\n`);
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    jsUrlInfo.sourcemap,
    magicResult.sourcemap,
  );
  return {
    content: magicResult.content,
    sourcemap,
  };
};
