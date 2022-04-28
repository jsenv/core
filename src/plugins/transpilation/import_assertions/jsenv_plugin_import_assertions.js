import { urlToFilename } from "@jsenv/filesystem"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"

import { babelPluginMetadataImportAssertions } from "./helpers/babel_plugin_metadata_import_assertions.js"

export const jsenvPluginImportAssertions = () => {
  const importAssertions = {
    name: "jsenv:import_assertions",
    appliesDuring: "*",
    transform: {
      js_module: async (urlInfo, context) => {
        const importTypesToHandle = getImportTypesToHandle(context)
        if (importTypesToHandle.length === 0) {
          return null
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportAssertions],
          urlInfo,
        })
        const { importAssertions } = metadata
        const magicSource = createMagicSource(urlInfo.content)
        importAssertions.forEach((importAssertion) => {
          const assertType = importAssertion.assert.type
          if (!importTypesToHandle.includes(assertType)) {
            return
          }
          const { searchParam } = importAsInfos[assertType]
          const { path } = importAssertion
          const { node } = path
          if (node.type === "CallExpression") {
            const importSpecifierPath = path.get("arguments")[0]
            const specifier = importSpecifierPath.node.value
            const reference = context.referenceUtils.findByGeneratedSpecifier(
              JSON.stringify(specifier),
            )
            const [newReference] = context.referenceUtils.update(reference, {
              expectedType: "js_module",
              specifier: injectQueryParamsIntoSpecifier(specifier, {
                [searchParam]: "",
              }),
              filename: `${urlToFilename(reference.url)}.js`,
            })
            magicSource.replace({
              start: importSpecifierPath.node.start,
              end: importSpecifierPath.node.end,
              replacement: newReference.generatedSpecifier,
            })
            const secondArgPath = path.get("arguments")[1]
            magicSource.remove({
              start: secondArgPath.node.start,
              end: secondArgPath.node.end,
            })
            return
          }
          const importSpecifierPath = path.get("source")
          const specifier = importSpecifierPath.node.value
          const reference = context.referenceUtils.findByGeneratedSpecifier(
            JSON.stringify(specifier),
          )
          const [newReference] = context.referenceUtils.update(reference, {
            expectedType: "js_module",
            specifier: injectQueryParamsIntoSpecifier(specifier, {
              [searchParam]: "",
            }),
            filename: `${urlToFilename(reference.url)}.js`,
          })
          magicSource.replace({
            start: importSpecifierPath.node.start,
            end: importSpecifierPath.node.end,
            replacement: newReference.generatedSpecifier,
          })
          const assertionsPath = path.get("assertions")[0]
          magicSource.remove({
            start: assertionsPath.node.start,
            end: assertionsPath.node.end,
          })
        })
        return magicSource.toContentAndSourcemap()
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
    load: (urlInfo, context) => {
      return loadOriginalUrl({
        urlInfo,
        context,
        searchParam: "as_json_module",
        convertToJsModule: (urlInfo) => {
          // here we could `export default ${jsonText}`:
          // but js engine are optimized to recognize JSON.parse
          // and use a faster parsing strategy
          return `export default JSON.parse(${JSON.stringify(
            urlInfo.content.trim(),
          )})`
        },
      })
    },
  }

  const asCssModule = {
    name: `jsenv:as_css_module`,
    appliesDuring: "*",
    load: (urlInfo, context) => {
      return loadOriginalUrl({
        urlInfo,
        context,
        searchParam: "as_css_module",
        convertToJsModule: (urlInfo) => {
          const cssText = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
            // If template string is choosen and runtime do not support template literals
            // it's ok because "jsenv:new_inline_content" plugin executes after this one
            // and convert template strings into raw strings
            canUseTemplateString: true,
          })
          return `import { InlineContent } from ${JSON.stringify(
            inlineContentClientFileUrl,
          )}
    
const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
const stylesheet = new CSSStyleSheet()
stylesheet.replaceSync(inlineContent.text)
export default stylesheet`
        },
      })
    },
  }

  const asTextModule = {
    name: `jsenv:as_text_module`,
    appliesDuring: "*",
    load: (urlInfo, context) => {
      return loadOriginalUrl({
        urlInfo,
        context,
        searchParam: "as_text_module",
        convertToJsModule: (urlInfo) => {
          const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
            // If template string is choosen and runtime do not support template literals
            // it's ok because "jsenv:new_inline_content" plugin executes after this one
            // and convert template strings into raw strings
            canUseTemplateString: true,
          })
          return `import { InlineContent } from ${JSON.stringify(
            inlineContentClientFileUrl,
          )}
    
const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`
        },
      })
    },
  }

  return [asJsonModule, asCssModule, asTextModule]
}

const loadOriginalUrl = async ({
  urlInfo,
  context,
  searchParam,
  expectedType,
  convertToJsModule,
}) => {
  const urlObject = new URL(urlInfo.url)
  const { searchParams } = urlObject
  if (!searchParams.has(searchParam)) {
    return null
  }
  searchParams.delete(searchParam)
  const originalUrl = urlObject.href
  const originalReference = {
    ...(context.reference.original || context.reference),
    expectedType,
  }
  originalReference.url = originalUrl
  const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
    originalReference.url,
  )
  await context.load({
    reference: originalReference,
    urlInfo: originalUrlInfo,
  })
  return {
    type: "js_module",
    contentType: "text/javascript",
    content: convertToJsModule(originalUrlInfo, context),
  }
}

const importAsInfos = {
  json: {
    searchParam: "as_json_module",
    expectedType: "json",
  },
  css: {
    searchParam: "as_css_module",
    expectedType: "css",
  },
  text: {
    searchParam: "as_text_module",
    expectedType: "text",
  },
}

const getImportTypesToHandle = ({ scenario, isSupportedOnCurrentClients }) => {
  // during build always replace import assertions with the js:
  // - means rollup can bundle more js file together
  // - means url versioning can work for css inlined in js
  // - avoid rollup to see import assertions
  //   We would have to tell rollup to ignore import with assertion
  if (scenario === "build") {
    return ["json", "css", "text"]
  }
  const importTypes = []
  if (!isSupportedOnCurrentClients("import_type_json")) {
    importTypes.push("json")
  }
  if (!isSupportedOnCurrentClients("import_type_css")) {
    importTypes.push("css")
  }
  if (!isSupportedOnCurrentClients("import_type_text")) {
    importTypes.push("text")
  }
  return importTypes
}
