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

import { urlToFilename, injectQueryParams } from "@jsenv/urls"

import { JS_QUOTES } from "@jsenv/utils/src/string/js_quotes.js"

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
    redirectUrl: {
      js_import_export: (reference, context) => {
        if (!reference.assert) {
          return null
        }
        // When to force transpilation:
        // - during build
        //   - avoid rollup to see import assertions
        //     We would have to tell rollup to ignore import with assertion
        //   - means rollup can bundle more js file together
        //   - means url versioning can work for css inlined in js
        // - rest of the time
        //  - fix a bug where opening the page both in chrome and firefox would
        //  create an infinite full reload as:
        //    - chrome use "file.css"
        //    - firefox do not use "file.css" but "file.css?as_css_module"
        //    -> server consider "file.css" as pruned for the file importing it
        //    -> chrome reloads and re-use "file.css"
        //    -> firefox reload, etc
        //  - bonus: same code runs during dev and after build
        const forceTranspilation = true

        if (reference.assert.type === "json") {
          if (
            forceTranspilation ||
            !context.isSupportedOnCurrentClients("import_type_json")
          ) {
            return updateReference(reference, "as_json_module")
          }
          return null
        }
        if (reference.assert.type === "css") {
          if (
            forceTranspilation ||
            !context.isSupportedOnCurrentClients("import_type_css")
          ) {
            return updateReference(reference, "as_css_module")
          }
          return null
        }
        if (reference.assert.type === "text") {
          if (
            forceTranspilation ||
            !context.isSupportedOnCurrentClients("import_type_text")
          ) {
            return updateReference(reference, "as_text_module")
          }
          return null
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
      const originalUrlInfo = await context.fetchOriginalUrlInfo({
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
        // here we could `export default ${jsonText}`:
        // but js engine are optimized to recognize JSON.parse
        // and use a faster parsing strategy
        content: `export default JSON.parse(${jsonText})`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: originalUrlInfo.originalUrl,
        originalContent: originalUrlInfo.originalContent,
      }
    },
  }

  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await context.fetchOriginalUrlInfo({
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
        content: `import { InlineContent } from ${JSON.stringify(
          inlineContentClientFileUrl,
        )}
  
  const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
  const stylesheet = new CSSStyleSheet()
  stylesheet.replaceSync(inlineContent.text)
  export default stylesheet`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: originalUrlInfo.originalUrl,
        originalContent: originalUrlInfo.originalContent,
      }
    },
  }

  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const originalUrlInfo = await context.fetchOriginalUrlInfo({
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
        content: `import { InlineContent } from ${JSON.stringify(
          inlineContentClientFileUrl,
        )}
  
const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`,
        contentType: "text/javascript",
        type: "js_module",
        originalUrl: originalUrlInfo.originalUrl,
        originalContent: originalUrlInfo.originalContent,
      }
    },
  }

  return [asJsonModule, asCssModule, asTextModule]
}
