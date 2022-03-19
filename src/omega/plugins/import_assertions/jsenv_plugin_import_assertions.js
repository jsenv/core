import { urlToRelativeUrl } from "@jsenv/filesystem"

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { contentTypeIsTextual } from "@jsenv/core/src/utils/content_type.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"
import { injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"

import { babelPluginMetadataImportAssertions } from "./babel_plugin_metadata_import_assertions.js"
import { convertJsonTextToJavascriptModule } from "./json_module.js"
import { convertCssTextToJavascriptModule } from "./css_module.js"
import { convertTextToJavascriptModule } from "./text_module.js"

export const jsenvPluginImportAssertions = () => {
  const importAssertions = [
    {
      name: "jsenv:import_assertions",
      appliesDuring: "*",
      transform: {
        js_module: async (
          { url, generatedUrl, content },
          { scenario, isSupportedOnRuntime },
        ) => {
          const importTypesToHandle = getImportTypesToHandle({
            scenario,
            isSupportedOnRuntime,
          })
          if (importTypesToHandle.length === 0) {
            return null
          }
          const { metadata } = await applyBabelPlugins({
            babelPlugins: [babelPluginMetadataImportAssertions],
            url: generatedUrl,
            content,
          })
          const { importAssertions } = metadata
          const magicSource = createMagicSource({ url, content })
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
              magicSource.replace({
                start: importSpecifierPath.node.start,
                end: importSpecifierPath.node.end,
                replacement: injectImportTypeInSpecifier(
                  importSpecifierPath.node.value,
                  importType,
                ),
              })
              const secondArgPath = path.get("arguments")[1]
              magicSource.remove({
                start: secondArgPath.node.start,
                end: secondArgPath.node.end,
              })
              return
            }
            const importSpecifierPath = path.get("source")
            magicSource.replace({
              start: importSpecifierPath.node.start,
              end: importSpecifierPath.node.end,
              replacement: injectImportTypeInSpecifier(
                importSpecifierPath.node.value,
                importType,
              ),
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
  const importTypeCss = {
    name: "jsenv:import_type_css",
    appliesDuring: "*",
    finalize: ({ url, contentType, content }) => {
      if (!new URL(url).searchParams.has("css_module")) {
        return null
      }
      if (contentType !== "text/css") {
        throw new Error(
          `Unexpected content type on ${url}, should be "text/css" but got ${contentType}`,
        )
      }
      return convertCssTextToJavascriptModule({
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
      if (contentTypeIsTextual(contentType)) {
        throw new Error(
          `Unexpected content type on ${url}, should be "text/*" but got ${contentType}`,
        )
      }
      return convertTextToJavascriptModule({
        content,
      })
    },
  }
  return [importAssertions, importTypeJson, importTypeCss, importTypeText]
}

const getImportTypesToHandle = ({ scenario, isSupportedOnRuntime }) => {
  // during build always replace import assertions with the js to feed
  // solely js to rollup
  if (scenario === "build") {
    return ["json", "css", "text"]
  }
  const importTypes = []
  if (!isSupportedOnRuntime("import_type_json")) {
    importTypes.push("json")
  }
  if (!isSupportedOnRuntime("import_type_css")) {
    importTypes.push("css")
  }
  if (!isSupportedOnRuntime("import_type_text")) {
    importTypes.push("text")
  }
  return importTypes
}

const injectImportTypeInSpecifier = (specifier, importType) => {
  const fakeOrigin = "http://jsenv.com"
  const url = new URL(specifier, fakeOrigin)
  const urlWithImportType = injectQueryParams(url, {
    [importType]: "",
  })
  if (urlWithImportType.startsWith(fakeOrigin)) {
    // specifier was relative
    const specifierWithImportType = urlToRelativeUrl(
      urlWithImportType,
      fakeOrigin,
    )
    return `./${specifierWithImportType}`
  }
  return urlWithImportType
}
