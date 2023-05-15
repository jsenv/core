import { createMagicSource } from "@jsenv/sourcemap";
import { parseJsUrls } from "@jsenv/ast";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";
import { jsenvPluginJsInlineContentAnalysis } from "./jsenv_plugin_js_inline_content_analysis.js";

export const jsenvPluginJsReferenceAnalysis = ({
  inlineContent,
  allowEscapeForVersioning,
}) => {
  return [
    {
      name: "jsenv:js_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        js_classic: parseAndTransformJsUrls,
        js_module: parseAndTransformJsUrls,
      },
    },
    ...(inlineContent
      ? [jsenvPluginJsInlineContentAnalysis({ allowEscapeForVersioning })]
      : []),
  ];
};

const parseAndTransformJsUrls = async (urlInfo, context) => {
  const jsMentions = await parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const jsMention of jsMentions) {
    if (
      jsMention.subtype === "import_static" ||
      jsMention.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true;
    }
    const [reference] = context.referenceUtils.found({
      node: jsMention.node,
      type: jsMention.type,
      subtype: jsMention.subtype,
      expectedType: jsMention.expectedType,
      expectedSubtype: jsMention.expectedSubtype || urlInfo.subtype,
      specifier: jsMention.specifier,
      specifierStart: jsMention.start,
      specifierEnd: jsMention.end,
      specifierLine: jsMention.line,
      specifierColumn: jsMention.column,
      data: jsMention.data,
      baseUrl: {
        "StringLiteral": jsMention.baseUrl,
        "window.location": urlInfo.url,
        "window.origin": context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[jsMention.baseUrlType],
      assert: jsMention.assert,
      assertNode: jsMention.assertNode,
      typePropertyNode: jsMention.typePropertyNode,
    });
    actions.push(async () => {
      const replacement = await context.referenceUtils.readGeneratedSpecifier(
        reference,
      );
      magicSource.replace({
        start: jsMention.start,
        end: jsMention.end,
        replacement,
      });
      if (reference.mutation) {
        reference.mutation(magicSource);
      }
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  const { content, sourcemap } = magicSource.toContentAndSourcemap();
  return { content, sourcemap };
};
