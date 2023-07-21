/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file = "./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error when it knows some browsers in runtimeCompat
 * do not support import assertions
 * But for now (as it is simpler) we let the browser throw the error
 */

import { urlToFilename, injectQueryParams } from "@jsenv/urls";
import { JS_QUOTES } from "@jsenv/utils/src/string/js_quotes.js";

export const jsenvPluginImportAssertions = ({
  json = "auto",
  css = "auto",
  text = "auto",
}) => {
  const transpilations = { json, css, text };
  const shouldTranspileImportAssertion = (reference, type) => {
    const transpilation = transpilations[type];
    if (transpilation === true) {
      return true;
    }
    if (transpilation === "auto") {
      return !reference.ownerUrlInfo.context.isSupportedOnCurrentClients(
        `import_type_${type}`,
      );
    }
    return false;
  };
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module";
    if (!reference.filename) {
      reference.filename = `${urlToFilename(reference.url)}.js`;
    }
  };
  const turnIntoJsModuleProxy = (reference, type) => {
    reference.mutation = (magicSource) => {
      const { importTypeAttributeNode } = reference.astInfo;
      if (reference.subtype === "import_dynamic") {
        magicSource.remove({
          start: importTypeAttributeNode.start,
          end: importTypeAttributeNode.end,
        });
      } else {
        const content = reference.ownerUrlInfo.content;
        const assertKeyboardStart = content.indexOf(
          "assert",
          importTypeAttributeNode.start - " assert { ".length,
        );
        const assertKeywordEnd = content.indexOf(
          "}",
          importTypeAttributeNode.end,
        );
        magicSource.remove({
          start: assertKeyboardStart,
          end: assertKeywordEnd + 1,
        });
      }
    };
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: "",
    });
    markAsJsModuleProxy(reference, type);
    return newUrl;
  };

  const importAssertions = {
    name: "jsenv:import_assertions",
    appliesDuring: "*",
    init: (context) => {
      // transpilation is forced during build so that
      //   - avoid rollup to see import assertions
      //     We would have to tell rollup to ignore import with assertion
      //   - means rollup can bundle more js file together
      //   - means url versioning can work for css inlined in js
      if (context.build) {
        transpilations.json = true;
        transpilations.css = true;
        transpilations.text = true;
      }
    },
    redirectReference: (reference) => {
      if (!reference.importAttributes) {
        return null;
      }
      const { searchParams } = reference;
      if (searchParams.has("as_json_module")) {
        markAsJsModuleProxy(reference, "json");
        return null;
      }
      if (searchParams.has("as_css_module")) {
        markAsJsModuleProxy(reference, "css");
        return null;
      }
      if (searchParams.has("as_text_module")) {
        markAsJsModuleProxy(reference, "text");
        return null;
      }
      const type = reference.importAttributes.type;
      if (shouldTranspileImportAssertion(reference, type)) {
        return turnIntoJsModuleProxy(reference, type);
      }
      return null;
    },
  };

  const asJsonModule = {
    name: `jsenv:as_json_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo) => {
      const jsonUrlInfo = urlInfo.getWithoutSearchParam("as_json_module", {
        expectedType: "json",
      });
      if (!jsonUrlInfo) {
        return null;
      }
      await jsonUrlInfo.fetchContent();
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim());
      return {
        // here we could `export default ${jsonText}`:
        // but js engine are optimized to recognize JSON.parse
        // and use a faster parsing strategy
        content: `export default JSON.parse(${jsonText})`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: jsonUrlInfo.originalUrl,
        originalContent: jsonUrlInfo.originalContent,
        data: jsonUrlInfo.data,
      };
    },
  };

  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo) => {
      const cssUrlInfo = urlInfo.getWithoutSearchParam("as_css_module", {
        expectedType: "css",
      });
      if (!cssUrlInfo) {
        return null;
      }
      await cssUrlInfo.fetchContent();
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      return {
        content: `import ${JSON.stringify(
          urlInfo.context.inlineContentClientFileUrl,
        )};

const inlineContent = new __InlineContent__(${cssText}, { type: "text/css" });
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
  };

  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo) => {
      const textUrlInfo = urlInfo.getWithoutSearchParam("as_text_module", {
        expectedType: "text",
      });
      if (!textUrlInfo) {
        return null;
      }
      await textUrlInfo.fetchContent();
      const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      });
      return {
        content: `import ${JSON.stringify(
          urlInfo.context.inlineContentClientFileUrl,
        )};

const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" });
export default inlineContent.text;`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      };
    },
  };

  return [importAssertions, asJsonModule, asCssModule, asTextModule];
};
