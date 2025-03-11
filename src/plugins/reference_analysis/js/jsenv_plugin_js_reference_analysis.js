import { getUrlForContentInsideJs, parseJsUrls } from "@jsenv/ast";
import {
  isWebWorkerEntryPointReference,
  isWebWorkerUrlInfo,
} from "@jsenv/core/src/kitchen/web_workers.js";
import { createMagicSource } from "@jsenv/sourcemap";
import { urlToExtension } from "@jsenv/urls";
import { JS_QUOTES } from "@jsenv/utils/src/string/js_quotes.js";

export const jsenvPluginJsReferenceAnalysis = ({ inlineContent }) => {
  return [
    {
      name: "jsenv:js_reference_analysis",
      appliesDuring: "*",
      transformUrlContent: {
        js_classic: (urlInfo) => {
          return parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          });
        },
        js_module: (urlInfo) => {
          return parseAndTransformJsReferences(urlInfo, {
            inlineContent,
            canUseTemplateLiterals:
              urlInfo.context.isSupportedOnCurrentClients("template_literals"),
          });
        },
      },
    },
  ];
};

const parseAndTransformJsReferences = async (
  urlInfo,
  { inlineContent, canUseTemplateLiterals },
) => {
  const magicSource = createMagicSource(urlInfo.content);
  const parallelActions = [];
  const sequentialActions = [];
  const isNodeJs =
    Object.keys(urlInfo.context.runtimeCompat).toString() === "node";

  const onInlineReference = (inlineReferenceInfo) => {
    const inlineUrl = getUrlForContentInsideJs(inlineReferenceInfo, urlInfo);
    let { quote } = inlineReferenceInfo;
    if (quote === "`" && !canUseTemplateLiterals) {
      // if quote is "`" and template literals are not supported
      // we'll use a regular string (single or double quote)
      // when rendering the string
      quote = JS_QUOTES.pickBest(inlineReferenceInfo.content);
    }
    const inlineReference = urlInfo.dependencies.foundInline({
      type: "js_inline_content",
      subtype: inlineReferenceInfo.type, // "new_blob_first_arg", "new_inline_content_first_arg", "json_parse_first_arg"
      isOriginalPosition: urlInfo.content === urlInfo.originalContent,
      specifierLine: inlineReferenceInfo.line,
      specifierColumn: inlineReferenceInfo.column,
      specifier: inlineUrl,
      contentType: inlineReferenceInfo.contentType,
      content: inlineReferenceInfo.content,
    });
    const inlineUrlInfo = inlineReference.urlInfo;
    inlineUrlInfo.jsQuote = quote;
    inlineReference.escape = (value) => {
      return JS_QUOTES.escapeSpecialChars(value.slice(1, -1), { quote });
    };

    sequentialActions.push(async () => {
      await inlineUrlInfo.cook();
      const replacement = JS_QUOTES.escapeSpecialChars(inlineUrlInfo.content, {
        quote,
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
    if (
      isNodeJs &&
      externalReferenceInfo.type === "js_url" &&
      externalReferenceInfo.expectedSubtype === "worker" &&
      externalReferenceInfo.expectedType === "js_classic" &&
      // TODO: it's true also if closest package.json
      // is type: module
      urlToExtension(
        new URL(externalReferenceInfo.specifier, urlInfo.url).href,
      ) === ".mjs"
    ) {
      externalReferenceInfo.expectedType = "js_module";
    }

    let filenameHint;
    if (
      externalReferenceInfo.subtype === "import_dynamic" &&
      isBareSpecifier(externalReferenceInfo.specifier)
    ) {
      filenameHint = `${externalReferenceInfo.specifier}.js`;
    }

    let isEntryPoint;
    let isDynamicEntryPoint;
    if (
      isNodeJs &&
      (externalReferenceInfo.type === "js_url" ||
        externalReferenceInfo.subtype === "import_meta_resolve")
    ) {
      isEntryPoint = true;
      isDynamicEntryPoint = true;
    } else if (
      isWebWorkerEntryPointReference({
        subtype: externalReferenceInfo.subtype,
        expectedSubtype: externalReferenceInfo.expectedSubtype,
      })
    ) {
      isEntryPoint = true;
    } else {
      isEntryPoint = false;
    }
    const reference = urlInfo.dependencies.found({
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
        "window.origin": urlInfo.context.rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
        "context.meta.url": urlInfo.url,
        "document.currentScript.src": urlInfo.url,
      }[externalReferenceInfo.baseUrlType],
      importAttributes: externalReferenceInfo.importAttributes,
      isSideEffectImport: externalReferenceInfo.isSideEffectImport,
      astInfo: externalReferenceInfo.astInfo,
      isEntryPoint,
      isDynamicEntryPoint,
      filenameHint,
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
        reference.mutation(magicSource, urlInfo);
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
    isNodeJs,
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
  for (const sequentialAction of sequentialActions) {
    await sequentialAction();
  }
  const { content, sourcemap } = magicSource.toContentAndSourcemap();
  return { content, sourcemap };
};

const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};
