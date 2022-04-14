import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { ContentType } from "@jsenv/utils/content_type/content_type.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { injectQueryParamsIntoSpecifier } from "@jsenv/utils/urls/url_utils.js"
import { JS_QUOTES } from "@jsenv/utils/string/js_quotes.js"

import { babelPluginMetadataImportAssertions } from "./helpers/babel_plugin_metadata_import_assertions.js"
import { convertJsonTextToJavascriptModule } from "./helpers/json_module.js"
import { convertTextToJavascriptModule } from "./helpers/text_module.js"

export const jsenvPluginImportAssertions = () => {
  const importAssertions = [
    {
      name: "jsenv:import_assertions",
      appliesDuring: "*",
      transform: {
        js_module: async (
          { url, generatedUrl, content },
          { scenario, isSupportedOnCurrentClient, referenceUtils },
        ) => {
          const importTypesToHandle = getImportTypesToHandle({
            scenario,
            isSupportedOnCurrentClient,
          })
          if (importTypesToHandle.length === 0) {
            return null
          }
          const { metadata } = await applyBabelPlugins({
            babelPlugins: [babelPluginMetadataImportAssertions],
            url,
            generatedUrl,
            content,
          })
          const { importAssertions } = metadata
          const magicSource = createMagicSource(content)
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

  const importTypeJson = {
    name: "jsenv:import_type_json",
    appliesDuring: "*",
    finalize: ({ url, contentType, content }) => {
      if (!new URL(url).searchParams.has("json_module")) {
        return null
      }
      if (contentType !== "application/json") {
        throw new Error(
          `Unexpected content type on ${url}, should be "application/json" but got ${contentType}`,
        )
      }
      return convertJsonTextToJavascriptModule({
        content,
      })
    },
  }

  // not standard but I expect this to happen one day?
  const importTypeText = {
    name: "jsenv:import_type_text",
    appliesDuring: "*",
    finalize: ({ url, contentType, content }) => {
      if (!new URL(url).searchParams.has("text_module")) {
        return null
      }
      if (ContentType.isTextual(contentType)) {
        throw new Error(
          `Unexpected content type on ${url}, should be "text/*" but got ${contentType}`,
        )
      }
      return convertTextToJavascriptModule({
        content,
      })
    },
  }

  return [
    importAssertions,
    importTypeJson,
    jsenvPluginImportTypeCss(),
    importTypeText,
  ]
}

const jsenvPluginImportTypeCss = () => {
  const inlineContentClientFileUrl = new URL(
    "../inline/client/inline_content.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:import_type_css",
    appliesDuring: "*",
    // load the original css url
    load: ({ data }, { urlGraph, load }) => {
      if (data.importType !== "css_module") {
        return null
      }
      return load({
        reference: data.originalReference,
        urlInfo: urlGraph.getUrlInfo(data.originalReference.url),
      })
    },
    transform: ({ url, data, contentType, content }, { referenceUtils }) => {
      if (data.importType !== "css_module") {
        return null
      }
      if (contentType !== "text/css") {
        throw new Error(
          `Unexpected content type on ${url}, should be "text/css" but got ${contentType}`,
        )
      }
      const [reference] = referenceUtils.inject({
        type: "js_import_export",
        specifier: inlineContentClientFileUrl,
      })
      const cssText = JS_QUOTES.escapeSpecialChars(content, {
        // If template string is choosen and runtime do not support template literals
        // it's ok because "jsenv:new_inline_content" plugin executes after this one
        // and convert template strings into raw strings
        canUseTemplateString: true,
      })
      return {
        type: "js_module",
        contentType: "application/javascript",
        content: `import { InlineContent } from ${reference.generatedSpecifier}

const css = new InlineContent(${cssText}, { type: "text/css" })
const stylesheet = new CSSStyleSheet()
stylesheet.replaceSync(css.text)
export default stylesheet`,
      }
    },
  }
}

const getImportTypesToHandle = ({ scenario, isSupportedOnCurrentClient }) => {
  // during build always replace import assertions with the js:
  // - means rollup can bundle more js file together
  // - means url versioning can work for css inlined in js
  // - avoid rollup to see import assertions
  //   We would have to tell rollup to ignore import with assertion
  if (scenario === "build") {
    return ["json", "css", "text"]
  }
  const importTypes = []
  if (!isSupportedOnCurrentClient("import_type_json")) {
    importTypes.push("json")
  }
  if (!isSupportedOnCurrentClient("import_type_css")) {
    importTypes.push("css")
  }
  if (!isSupportedOnCurrentClient("import_type_text")) {
    importTypes.push("text")
  }
  return importTypes
}
