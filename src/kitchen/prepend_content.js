import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import {
  parseHtml,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  applyBabelPlugins,
} from "@jsenv/ast";

export const prependContent = async (
  urlInfoReceivingCode,
  urlInfoToPrepend,
) => {
  // we could also implement:
  // - prepend svg in html
  // - prepend css in html
  // - prepend css in css
  // - maybe more?
  // but no need for now
  if (
    urlInfoReceivingCode.type === "html" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInHtml(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_classic" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    prependJsClassicInJsClassic(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  if (
    urlInfoReceivingCode.type === "js_module" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    await prependJsClassicInJsModule(urlInfoReceivingCode, urlInfoToPrepend);
    return;
  }
  throw new Error(
    `cannot prepend content from "${urlInfoToPrepend.type}" into "${urlInfoReceivingCode.type}"`,
  );
};

const prependJsClassicInHtml = (htmlUrlInfo, urlInfoToPrepend) => {
  const htmlAst = parseHtml({
    html: htmlUrlInfo.content,
    url: htmlUrlInfo.url,
  });
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      ...(urlInfoToPrepend.url
        ? { "inlined-from-src": urlInfoToPrepend.url }
        : {}),
      children: urlInfoToPrepend.content,
    }),
    "jsenv:core",
  );
  const content = stringifyHtmlAst(htmlAst);
  htmlUrlInfo.mutateContent({ content });
};

const prependJsClassicInJsClassic = (jsUrlInfo, urlInfoToPrepend) => {
  const magicSource = createMagicSource(jsUrlInfo.content);
  magicSource.prepend(`${urlInfoToPrepend.content}\n\n`);
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    jsUrlInfo.sourcemap,
    magicResult.sourcemap,
  );
  jsUrlInfo.mutateContent({
    content: magicResult.content,
    sourcemap,
  });
};

const prependJsClassicInJsModule = async (jsUrlInfo, urlInfoToPrepend) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      [
        babelPluginPrependCodeInJsModule,
        { codeToPrepend: urlInfoToPrepend.content },
      ],
    ],
    input: jsUrlInfo.content,
    inputIsJsModule: true,
    inputUrl: jsUrlInfo.originalUrl,
  });
  jsUrlInfo.mutateContent({
    content: code,
    sourcemap: map,
  });
};
const babelPluginPrependCodeInJsModule = (babel) => {
  return {
    name: "prepend-code-in-js-module",
    visitor: {
      Program: (programPath, state) => {
        const { codeToPrepend } = state.opts;
        const astToPrepend = babel.parse(codeToPrepend);
        const bodyNodePaths = programPath.get("body");
        for (const bodyNodePath of bodyNodePaths) {
          if (bodyNodePath.node.type === "ImportDeclaration") {
            continue;
          }
          bodyNodePath.insertBefore(astToPrepend.program.body);
          return;
        }
        bodyNodePaths.unshift(astToPrepend.program.body);
      },
    },
  };
};
