import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"

import { babelPluginMetadataImportAssertions } from "./helpers/babel_plugin_metadata_import_assertions.js"

export const jsenvPluginImportAssertions = () => {
  const inlineContentClientFileUrl = new URL(
    "../../inline/client/inline_content.js",
    import.meta.url,
  ).href

  const importAssertions = [
    {
      name: "jsenv:import_assertions",
      appliesDuring: "*",
      transform: {
        js_module: async (
          urlInfo,
          { scenario, isSupportedOnCurrentClients, referenceUtils },
        ) => {
          const importTypesToHandle = getImportTypesToHandle({
            scenario,
            isSupportedOnCurrentClients,
          })
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
            const { path } = importAssertion
            const { node } = path
            const importType = `${assertType}_module`
            if (node.type === "CallExpression") {
              const importSpecifierPath = path.get("arguments")[0]
              const specifier = importSpecifierPath.node.value
              const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
                [importType]: "",
              })
              const [newReference, newUrlInfo] = referenceUtils.updateSpecifier(
                JSON.stringify(specifier),
                newSpecifier,
              )
              newReference.expectedType = importType
              newUrlInfo.data.importType = importType
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
            const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
              [importType]: "",
            })
            const [newReference, newUrlInfo] = referenceUtils.updateSpecifier(
              JSON.stringify(specifier),
              newSpecifier,
            )
            newReference.expectedType = importType
            newUrlInfo.data.importType = importType
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
    },
  ]

  const createImportTypePlugin = ({ type, convertToJsModule }) => {
    return {
      name: `jsenv:import_type_${type}`,
      appliesDuring: "*",
      load: (urlInfo, context) => {
        if (urlInfo.data.importType !== `${type}_module`) {
          return null
        }
        const { originalReference } = urlInfo.data
        // we must call "reuseOrCreateUrlInfo" and not "getUrlInfo"
        // because kitchen.js delete urls without dependents after "updateSpecifier"
        // so that build realizes the urls is not used
        // an other approach could be to filter out non-reference url at the end of the build
        const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
          originalReference.url,
        )
        return context.load({
          reference: originalReference,
          urlInfo: originalUrlInfo,
        })
      },
      transform: (urlInfo, context) => {
        if (urlInfo.data.importType !== `${type}_module`) {
          return null
        }
        return {
          type: "js_module",
          contentType: "text/javascript",
          content: convertToJsModule(urlInfo, context),
        }
      },
    }
  }

  const importTypeJson = createImportTypePlugin({
    type: "json",
    convertToJsModule: (urlInfo) => {
      // here we could `export default ${jsonText}`:
      // but js engine are optimized to recognize JSON.parse
      // and use a faster parsing strategy
      return `export default JSON.parse(${JSON.stringify(
        urlInfo.content.trim(),
      )})`
    },
  })

  const importTypeCss = createImportTypePlugin({
    type: "css",
    convertToJsModule: (urlInfo, context) => {
      const cssText = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      })
      const [reference] = context.referenceUtils.inject({
        type: "js_import_export",
        expectedType: "js_module",
        specifier: inlineContentClientFileUrl,
      })
      return `import { InlineContent } from ${reference.generatedSpecifier}

const inlineContent = new InlineContent(${cssText}, { type: "text/css" })
const stylesheet = new CSSStyleSheet()
stylesheet.replaceSync(inlineContent.text)
export default stylesheet`
    },
  })

  const importTypeText = createImportTypePlugin({
    type: "text",
    convertToJsModule: (urlInfo, context) => {
      const textPlain = JS_QUOTES.escapeSpecialChars(urlInfo.content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      })
      const [reference] = context.referenceUtils.inject({
        type: "js_import_export",
        expectedType: "js_module",
        specifier: inlineContentClientFileUrl,
      })
      return `import { InlineContent } from ${reference.generatedSpecifier}

const inlineContent = new InlineContent(${textPlain}, { type: "text/plain" })
export default inlineContent.text`
    },
  })

  return [importAssertions, importTypeJson, importTypeCss, importTypeText]
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
