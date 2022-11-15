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

export const jsenvPluginImportAssertions = ({
  json = "auto",
  css = "auto",
  text = "auto",
}) => {
  const transpilations = { json, css, text }
  const shouldTranspileImportAssertion = (context, type) => {
    const transpilation = transpilations[type]
    if (transpilation === true) {
      return true
    }
    if (transpilation === "auto") {
      return !context.isSupportedOnCurrentClients(`import_type_${type}`)
    }
    return false
  }
  const markAsJsModuleProxy = (reference) => {
    reference.expectedType = "js_module"
    reference.filename = `${urlToFilename(reference.url)}.js`
  }
  const turnIntoJsModuleProxy = (reference, type) => {
    reference.mutation = (magicSource) => {
      magicSource.remove({
        start: reference.assertNode.start,
        end: reference.assertNode.end,
      })
    }
    const newUrl = injectQueryParams(reference.url, {
      [`as_${type}_module`]: "",
    })
    markAsJsModuleProxy(reference)
    return newUrl
  }

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
        transpilations.json = true
        transpilations.css = true
        transpilations.text = true
      }
    },
    redirectUrl: {
      js_import: (reference, context) => {
        if (!reference.assert) {
          return null
        }
        const { searchParams } = reference
        if (
          searchParams.has("as_json_module") ||
          searchParams.has("as_css_module") ||
          searchParams.has("as_text_module")
        ) {
          markAsJsModuleProxy(reference)
          return null
        }
        const type = reference.assert.type
        if (shouldTranspileImportAssertion(context, type)) {
          return turnIntoJsModuleProxy(reference, type)
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
      const [jsonReference, jsonUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_json_module",
        expectedType: "json",
      })
      if (!jsonReference) {
        return null
      }
      await context.fetchUrlContent(jsonUrlInfo, {
        reference: jsonReference,
      })
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: jsonReference.subtype,
          specifier: jsonReference.url,
          expectedType: "js_module",
        })
      } else if (context.build && jsonUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(jsonUrlInfo.url)
      }
      const jsonText = JSON.stringify(jsonUrlInfo.content.trim())
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
      }
    },
  }

  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const [cssReference, cssUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_css_module",
        expectedType: "css",
      })
      if (!cssReference) {
        return null
      }
      await context.fetchUrlContent(cssUrlInfo, {
        reference: cssReference,
      })
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: cssReference.subtype,
          specifier: cssReference.url,
          expectedType: "js_module",
        })
      } else if (context.build && cssUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(cssUrlInfo.url)
      }
      const cssText = JS_QUOTES.escapeSpecialChars(cssUrlInfo.content, {
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
        originalUrl: cssUrlInfo.originalUrl,
        originalContent: cssUrlInfo.originalContent,
        data: cssUrlInfo.data,
      }
    },
  }

  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    fetchUrlContent: async (urlInfo, context) => {
      const [textReference, textUrlInfo] = context.getWithoutSearchParam({
        urlInfo,
        context,
        searchParam: "as_text_module",
        expectedType: "text",
      })
      if (!textReference) {
        return null
      }
      await context.fetchUrlContent(textUrlInfo, {
        reference: textReference,
      })
      if (context.dev) {
        context.referenceUtils.found({
          type: "js_import",
          subtype: textReference.subtype,
          specifier: textReference.url,
          expectedType: "js_module",
        })
      } else if (context.build && textUrlInfo.dependents.size === 0) {
        context.urlGraph.deleteUrlInfo(textUrlInfo.url)
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
        originalUrl: textUrlInfo.originalUrl,
        originalContent: textUrlInfo.originalContent,
        data: textUrlInfo.data,
      }
    },
  }

  return [asJsonModule, asCssModule, asTextModule]
}
