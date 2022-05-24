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

import { urlToFilename } from "@jsenv/filesystem"

import { injectQueryParams } from "@jsenv/utils/urls/url_utils.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"

import { fetchOriginalUrlInfo } from "../fetch_original_url_info.js"

export const jsenvPluginImportAssertions = () => {
  const updateReference = (reference, searchParam) => {
    reference.expectedType = "js_module"
    reference.filename = `${urlToFilename(reference.url)}.js`
    reference.mutation = (magicSource) => {
      magicSource.remove({
        start: reference.assertNode.start,
        end: reference.assertNode.end,
      })
    }
    const newUrl = injectQueryParams(reference.url, {
      [searchParam]: "",
    })
    return newUrl
  }

  const importAssertions = {
    name: "jsenv:import_assertions",
    appliesDuring: "*",
    normalizeUrl: {
      js_import_export: (reference, context) => {
        if (!reference.assert) {
          return null
        }
        // during build always replace import assertions with the js:
        // - avoid rollup to see import assertions
        //   We would have to tell rollup to ignore import with assertion
        // - means rollup can bundle more js file together
        // - means url versioning can work for css inlined in js
        if (reference.assert.type === "json") {
          if (
            context.scenario !== "build" &&
            context.isSupportedOnCurrentClients("import_type_json")
          ) {
            return null
          }
          return updateReference(reference, "as_json_module")
        }
        if (reference.assert.type === "css") {
          if (
            context.scenario !== "build" &&
            context.isSupportedOnCurrentClients("import_type_css")
          ) {
            return null
          }
          return updateReference(reference, "as_css_module")
        }
        if (reference.assert.type === "text") {
          if (
            context.scenario !== "build" &&
            context.isSupportedOnCurrentClients("import_type_text")
          ) {
            return null
          }
          return updateReference(reference, "as_text_module")
        }
        return null
      },
    },
  }
  return [importAssertions, ...jsenvPluginAsModules()]
}

const jsenvPluginAsModules = () => {
  const inlineContentClientFileUrl = new URL(
    "../../inline/client/inline_content.js",
    import.meta.url,
  ).href

  const asJsonModule = {
    name: `jsenv:as_json_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_json_module",
        expectedType: "json",
      })
      if (!originalUrlInfo) {
        return null
      }
      const jsonText = JSON.stringify(originalUrlInfo.content.trim())
      return {
        type: "js_module",
        contentType: "text/javascript",
        // here we could `export default ${jsonText}`:
        // but js engine are optimized to recognize JSON.parse
        // and use a faster parsing strategy
        content: `export default JSON.parse(${jsonText})`,
      }
    },
  }

  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_css_module",
        expectedType: "css",
      })
      if (!originalUrlInfo) {
        return null
      }
      const cssText = JS_QUOTES.escapeSpecialChars(originalUrlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      })
      return {
        type: "js_module",
        contentType: "text/javascript",
        content: `import { InlineContent } from ${JSON.stringify(
          inlineContentClientFileUrl,
        )}
  
  const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
  const stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(inlineContent.text)
  export default stylesheet`,
      }
    },
  }

  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await fetchOriginalUrlInfo({
        urlInfo,
        context,
        searchParam: "as_text_module",
        expectedType: "text",
      })
      if (!originalUrlInfo) {
        return null
      }
      const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      })
      return {
        type: "js_module",
        contentType: "text/javascript",
        content: `import { InlineContent } from ${JSON.stringify(
          inlineContentClientFileUrl,
        )}
  
const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`,
      }
    },
  }

  return [asJsonModule, asCssModule, asTextModule]
}
