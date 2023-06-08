import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  applyBabelPlugins,
} from "@jsenv/ast";

export const prependContent = (
  urlInfoTransformer,
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
    return prependJsClassicInHtml(
      urlInfoTransformer,
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
  }
  if (
    urlInfoReceivingCode.type === "js_classic" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    return prependJsClassicInJsClassic(
      urlInfoTransformer,
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
  }
  if (
    urlInfoReceivingCode.type === "js_module" &&
    urlInfoToPrepend.type === "js_classic"
  ) {
    return prependJsClassicInJsModule(
      urlInfoTransformer,
      urlInfoReceivingCode,
      urlInfoToPrepend,
    );
  }
  throw new Error(
    `cannot prepend content from "${urlInfoToPrepend.type}" into "${urlInfoReceivingCode.type}"`,
  );
};

const prependJsClassicInHtml = (
  urlInfoTransformer,
  htmlUrlInfo,
  urlInfoToPrepend,
) => {
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
  urlInfoTransformer.applyTransformations(htmlUrlInfo, { content });
};

const prependJsClassicInJsClassic = (
  urlInfoTransformer,
  jsUrlInfo,
  urlInfoToPrepend,
) => {
  const magicSource = createMagicSource(jsUrlInfo.content);
  magicSource.prepend(`${urlInfoToPrepend.content}\n\n`);
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    jsUrlInfo.sourcemap,
    magicResult.sourcemap,
  );
  urlInfoTransformer.applyTransformations(jsUrlInfo, {
    content: magicResult.content,
    sourcemap,
  });
};

const prependJsClassicInJsModule = async (
  urlInfoTransformer,
  jsUrlInfo,
  urlInfoToPrepend,
) => {
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
  urlInfoTransformer.applyTransformations(jsUrlInfo, {
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
