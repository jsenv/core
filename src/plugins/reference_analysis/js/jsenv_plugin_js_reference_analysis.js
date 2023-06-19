import { createMagicSource } from "@jsenv/sourcemap";
import { parseJsUrls } from "@jsenv/ast";
import { generateInlineContentUrl } from "@jsenv/urls";
import { JS_QUOTES } from "@jsenv/utils/src/string/js_quotes.js";
import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";

export const jsenvPluginJsReferenceAnalysis = ({
  inlineContent,
  allowEscapeForVersioning,
}) => {
  return [
    {
      name: "jsenv:js_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        js_classic: (urlInfo, context) =>
          parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            allowEscapeForVersioning,
            canUseTemplateLiterals:
              context.isSupportedOnCurrentClients("template_literals"),
          }),
        js_module: (urlInfo, context) =>
          parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            allowEscapeForVersioning,
            canUseTemplateLiterals:
              context.isSupportedOnCurrentClients("template_literals"),
          }),
      },
    },
  ];
};

const parseAndTransformJsReferences = async (
  urlInfo,
  { inlineContent, allowEscapeForVersioning, canUseTemplateLiterals },
) => {
  const magicSource = createMagicSource(urlInfo.content);
  const parallelActions = [];
  const sequentialActions = [];

  const onInlineReference = (inlineReferenceInfo) => {
    const inlineUrl = generateInlineContentUrl({
      url: urlInfo.url,
      extension: CONTENT_TYPE.asFileExtension(inlineReferenceInfo.contentType),
      line: inlineReferenceInfo.line,
      column: inlineReferenceInfo.column,
      lineEnd: inlineReferenceInfo.lineEnd,
      columnEnd: inlineReferenceInfo.columnEnd,
    });
    let { quote } = inlineReferenceInfo;
    if (quote === "`" && !canUseTemplateLiterals) {
      // if quote is "`" and template literals are not supported
      // we'll use a regular string (single or double quote)
      // when rendering the string
      quote = JS_QUOTES.pickBest(inlineReferenceInfo.content);
    }
    const [inlineReference, inlineUrlInfo] = urlInfo.references.foundInline({
      type: "js_inline_content",
      subtype: inlineReferenceInfo.type, // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
      isOriginalPosition: urlInfo.content === urlInfo.originalContent,
      specifierLine: inlineReferenceInfo.line,
      specifierColumn: inlineReferenceInfo.column,
      specifier: inlineUrl,
      contentType: inlineReferenceInfo.contentType,
      content: inlineReferenceInfo.content,
    });
    inlineUrlInfo.jsQuote = quote;
    inlineReference.escape = (value) =>
      JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote });

    sequentialActions.push(async () => {
      await inlineUrlInfo.cook();
      const replacement = JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
        quote,
        allowEscapeForVersioning,
      });
      magicSource.replace({
        start: inlineReferenceInfo.start,
        end: inlineReferenceInfo.end,
        replacement,
      });
    });
  };
  const onExternalReference = (externalReferenceInfo) => {
    if (
      externalReferenceInfo.subtype === "import_static" ||
      externalReferenceInfo.subtype === "import_dynamic"
    ) {
      urlInfo.data.usesImport = true;
    }
    const [reference] = urlInfo.references.found({
      node: externalReferenceInfo.node,
      type: externalReferenceInfo.type,
      subtype: externalReferenceInfo.subtype,
      expectedType: externalReferenceInfo.expectedType,
      expectedSubtype: externalReferenceInfo.expectedSubtype || urlInfo.subtype,
      specifier: externalReferenceInfo.specifier,
      specifierStart: externalReferenceInfo.start,
      specifierEnd: externalReferenceInfo.end,
      specifierLine: externalReferenceInfo.line,
      specifierColumn: externalReferenceInfo.column,
      data: externalReferenceInfo.data,
      baseUrl: {
        "StringLiteral": externalReferenceInfo.baseUrl,
        "window.location": urlInfo.url,
        "window.origin": urlInfo.kitchen.context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[externalReferenceInfo.baseUrlType],
      assert: externalReferenceInfo.assert,
      assertNode: externalReferenceInfo.assertNode,
      typePropertyNode: externalReferenceInfo.typePropertyNode,
    });
    parallelActions.push(async () => {
      await reference.readGeneratedSpecifier();
      const replacement = reference.generatedSpecifier;
      magicSource.replace({
        start: externalReferenceInfo.start,
        end: externalReferenceInfo.end,
        replacement,
      });
      if (reference.mutation) {
        reference.mutation(magicSource);
      }
    });
  };
  const jsReferenceInfos = parseJsUrls({
    js: urlInfo.content,
    url: urlInfo.originalUrl,
    ast: urlInfo.contentAst,
    isJsModule: urlInfo.type === "js_module",
    isWebWorker: isWebWorkerUrlInfo(urlInfo),
    inlineContent,
  });
  for (const jsReferenceInfo of jsReferenceInfos) {
    if (jsReferenceInfo.isInline) {
      onInlineReference(jsReferenceInfo);
    } else {
      onExternalReference(jsReferenceInfo);
    }
  }
  if (parallelActions.length > 0) {
    await Promise.all(parallelActions.map((action) => action()));
  }
  if (sequentialActions.length > 0) {
    await sequentialActions.reduce(async (previous, action) => {
      await previous;
      await action();
    }, Promise.resolve());
  }

  const { content, sourcemap } = magicSource.toContentAndSourcemap();
  return { content, sourcemap };
};
