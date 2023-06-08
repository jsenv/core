// TODO: reuse to inject versioning

import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
} from "@jsenv/ast";

export const prependContent = (
  urlInfoTransformer,
  urlInfoReceivingCode,
  urlInfoToPrepend,
) => {
  if (urlInfoReceivingCode.type === "html") {
    const scriptInjection = prependContentInHtml(
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
    urlInfoTransformer.applyTransformations(
      urlInfoReceivingCode,
      scriptInjection,
    );
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_classic" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    const jsInjection = prependContentInJsClassic(
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
    urlInfoTransformer.applyTransformations(urlInfoReceivingCode, jsInjection);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_module" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    const jsInjection = prependContentInJsModule(
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
    urlInfoTransformer.applyTransformations(urlInfoReceivingCode, jsInjection);
    return;
  }
  // ideally we could for css as well
  // otherwise throw an error
  return;
};

const prependContentInHtml = (htmlUrlInfo, urlInfoToPrepend) => {
  const htmlAst = parseHtmlString(htmlUrlInfo.content);
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: urlInfoToPrepend.content,
      ...(urlInfoToPrepend.url
        ? { "inlined-from-src": urlInfoToPrepend.url }
        : {}),
    }),
    "jsenv:core",
  );
  const content = stringifyHtmlAst(htmlAst);
  return { content };
};

const prependContentInJsClassic = (jsUrlInfo, urlInfoToPrepend) => {
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

const prependContentInJsModule = (jsUrlInfo, urlInfoToPrepend) => {
  // TODO: we must parse to inject after static imports
};
