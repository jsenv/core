/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { with: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import attributes
 * But for now (as it is simpler) we let the browser throw the error
 */

import { urlToFilename, injectQueryParams } from "@jsenv/urls";
import { JS_QUOTES } from "@jsenv/utils/src/string/js_quotes.js";

export const jsenvPluginImportAttributes = ({
  json = "auto",
  css = "auto",
  text = "auto",
}) => {
  const transpilations = { json, css, text };
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filenameHint) {
      reference.filenameHint = `${urlToFilename(reference.url)}.js`;
    }
  };
  const turnIntoJsModuleProxy = (reference, type) => {
    reference.mutation = (magicSource) => {
      if (reference.subtype === "import_dynamic") {
        const { importTypeAttributeNode } = reference.astInfo;
        magicSource.remove({
          start: importTypeAttributeNode.start,
          end: importTypeAttributeNode.end,
        });
      } else {
        const { importTypeAttributeNode } = reference.astInfo;
        const content = reference.ownerUrlInfo.content;
        const withKeywordStart = content.indexOf(
          "with",
          importTypeAttributeNode.start - " with { ".length,
        );
        const withKeywordEnd = content.indexOf(
          "}",
          importTypeAttributeNode.end,
        );
        magicSource.remove({
          start: withKeywordStart,
          end: withKeywordEnd + 1,
        });
      }
    };
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: "",
    });
    markAsJsModuleProxy(reference, type);
    return newUrl;
  };

  const createImportTypePlugin = ({ type, createUrlContent }) => {
    return {
      name: `jsenv:import_type_${type}`,
      appliesDuring: "*",
      init: (context) => {
        // transpilation is forced during build so that
        //   - avoid rollup to see import assertions
        //     We would have to tell rollup to ignore import with assertion
        //   - means rollup can bundle more js file together
        //   - means url versioning can work for css inlined in js
        if (context.build) {
          return true;
        }
        const transpilation = transpilations[type];
        if (transpilation === "auto") {
          return !context.isSupportedOnCurrentClients(`import_type_${type}`);
        }
        return transpilation;
      },
      redirectReference: (reference) => {
        if (!reference.importAttributes) {
          return null;
        }
        const { searchParams } = reference;
        if (searchParams.has(`as_${type}_module`)) {
          markAsJsModuleProxy(reference, type);
          return null;
        }
        // when search param is injected, it will be removed later
        // by "getWithoutSearchParam". We don't want to redirect again
        // (would create infinite recursion)
        if (
          reference.prev &&
          reference.prev.searchParams.has(`as_${type}_module`)
        ) {
          return null;
        }
        if (reference.importAttributes.type === type) {
          return turnIntoJsModuleProxy(reference, type);
        }
        return null;
      },
      fetchUrlContent: async (urlInfo) => {
        const originalUrlInfo = urlInfo.getWithoutSearchParam(
          `as_${type}_module`,
          {
            expectedType: "json",
          },
        );
        if (!originalUrlInfo) {
          return null;
        }
        await originalUrlInfo.cook();
        return createUrlContent(originalUrlInfo);
      },
    };
  };

  const asJsonModule = createImportTypePlugin({
    type: "json",
    createUrlContent: (jsonUrlInfo) => {
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      let inlineContentCall;
      // here we could `export default ${jsonText}`:
      // but js engine are optimized to recognize JSON.parse
      // and use a faster parsing strategy
      if (jsonUrlInfo.context.dev) {
        inlineContentCall = `JSON.parse(
  ${jsonText},
  //# inlinedFromUrl=${jsonUrlInfo.url}
)`;
      } else {
        inlineContentCall = `JSON.parse(${jsonText})`;
      }
      return {
        content: `export default ${inlineContentCall};`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data,
      };
    },
  });

  const asCssModule = createImportTypePlugin({
    type: "css",
    createUrlContent: (cssUrlInfo) => {
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (cssUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${cssText},
  { type: "text/css" },
  //# inlinedFromUrl=${cssUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${cssText}, { type: "text/css" })`;
      }
      return {
        content: `
import ${JSON.stringify(cssUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);

export default stylesheet;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data,
      };
    },
  });

  const asTextModule = createImportTypePlugin({
    type: "text",
    createUrlContent: (textUrlInfo) => {
      const textPlain = JS_QUOTES.escapeSpecialChars(textUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      let inlineContentCall;
      if (textUrlInfo.context.dev) {
        inlineContentCall = `new __InlineContent__(
  ${textPlain},
  { type: "text/plain"},
  //# inlinedFromUrl=${textUrlInfo.url}
)`;
      } else {
        inlineContentCall = `new __InlineContent__(${textPlain}, { type: "text/plain"})`;
      }
      return {
        content: `
import ${JSON.stringify(textUrlInfo.context.inlineContentClientFileUrl)};

const inlineContent = ${inlineContentCall};

export default inlineContent.text;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      };
    },
  });

  return [asJsonModule, asCssModule, asTextModule];
};
