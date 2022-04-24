import { createRequire } from "node:module"
import { readFileSync, urlToFilename } from "@jsenv/filesystem"

import { requireBabelPlugin } from "@jsenv/babel-plugins"
import {
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  parseHtmlString,
  removeHtmlNodeAttribute,
  stringifyHtmlAst,
  visitHtmlAst,
  htmlNodePosition,
  setHtmlNodeText,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import {
  injectQueryParams,
  injectQueryParamsIntoSpecifier,
} from "@jsenv/utils/urls/url_utils.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { analyzeNewWorkerCall } from "@jsenv/utils/js_ast/js_static_analysis.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import { babelPluginTransformImportMetaUrl } from "./helpers/babel_plugin_transform_import_meta_url.js"

const require = createRequire(import.meta.url)

export const jsenvPluginAsJsClassic = ({ systemJsInjection }) => {
  const systemJsClientFileUrl = new URL("./client/s.js", import.meta.url).href

  return [
    asJsClassic({ systemJsInjection, systemJsClientFileUrl }),
    scriptTypeModuleAsClassic({ systemJsInjection, systemJsClientFileUrl }),
    workersTypeModuleAsClassic(),
    topLevelAwait(),
  ]
}

const asJsClassic = ({ systemJsInjection, systemJsClientFileUrl }) => {
  const convertJsModuleToJsClassic = async (urlInfo, outFormat) => {
    const { code, map } = await applyBabelPlugins({
      babelPlugins: [
        ...(outFormat === "system"
          ? [
              // propposal-dynamic-import required with systemjs for babel8:
              // https://github.com/babel/babel/issues/10746
              require("@babel/plugin-proposal-dynamic-import"),
              [
                requireBabelPlugin("babel-plugin-transform-async-to-promises"),
                {
                  topLevelAwait: "return",
                },
              ],
              require("@babel/plugin-transform-modules-systemjs"),
            ]
          : [
              [
                requireBabelPlugin("babel-plugin-transform-async-to-promises"),
                {
                  topLevelAwait: "simple",
                },
              ],
              babelPluginTransformImportMetaUrl,
              require("@babel/plugin-transform-modules-umd"),
            ]),
      ],
      urlInfo,
    })
    if (
      systemJsInjection &&
      outFormat === "system" &&
      (urlInfo.data.isEntryPoint ||
        urlInfo.subtype === "worker" ||
        urlInfo.subtype === "service_worker" ||
        urlInfo.subtype === "shared_worker")
    ) {
      const magicSource = createMagicSource(code)
      const systemjsCode = readFileSync(systemJsClientFileUrl, { as: "string" })
      magicSource.prepend(`${systemjsCode}\n\n`)
      const { content, sourcemap } = magicSource.toContentAndSourcemap()
      return {
        content,
        sourcemap: await composeTwoSourcemaps(map, sourcemap),
      }
    }
    return {
      content: code,
      sourcemap: map,
    }
  }

  return {
    name: "jsenv:as_js_classic",
    // forward ?as_js_classic to referenced urls
    normalize: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (
        !parentUrlInfo ||
        !new URL(parentUrlInfo.url).searchParams.has("as_js_classic")
      ) {
        return null
      }
      const urlTransformed = injectQueryParams(reference.url, {
        as_js_classic: "",
      })
      return urlTransformed
    },
    load: async (urlInfo, context) => {
      const urlObject = new URL(urlInfo.url)
      const { searchParams } = urlObject
      if (!searchParams.has("as_js_classic")) {
        return null
      }
      searchParams.delete("as_js_classic")
      const originalUrl = urlObject.href
      const originalReference = {
        ...context.reference,
      }
      originalReference.url = originalUrl
      const originalUrlInfo = context.urlGraph.reuseOrCreateUrlInfo(
        originalReference.url,
      )
      await context.load({
        reference: originalReference,
        urlInfo: originalUrlInfo,
      })
      const jsClassicFormat =
        originalUrlInfo.data.usesImport || originalUrlInfo.data.usesExport
          ? "system"
          : "umd"
      const { content, sourcemap } = await convertJsModuleToJsClassic(
        urlInfo,
        jsClassicFormat,
      )
      urlInfo.data.jsClassicFormat = jsClassicFormat
      return {
        type: "js_classic",
        contentType: "text/javascript",
        content,
        sourcemap,
        filename: generateJsClassicFilename(urlInfo.url),
      }
    },
  }
}

const scriptTypeModuleAsClassic = ({
  systemJsInjection,
  systemJsClientFileUrl,
}) => {
  return {
    name: "jsenv:script_type_module_as_classic",
    appliesDuring: "*",
    transform: {
      html: async (urlInfo, context) => {
        if (
          context.isSupportedOnCurrentClients("script_type_module") &&
          context.isSupportedOnCurrentClients("import_dynamic")
        ) {
          return null
        }
        const usesScriptTypeModule = urlInfo.references.some(
          (ref) =>
            ref.type === "script_src" && ref.expectedType === "js_module",
        )
        if (!usesScriptTypeModule) {
          return null
        }
        const htmlAst = parseHtmlString(urlInfo.content)
        const actions = []
        const jsModulesToWait = []
        const visitScriptTypeModule = (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const typeAttribute = getHtmlNodeAttributeByName(node, "type")
          if (!typeAttribute || typeAttribute.value !== "module") {
            return
          }
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (srcAttribute) {
            actions.push(() => {
              const specifier = srcAttribute.value
              const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
                as_js_classic: "",
              })
              const [, newReference, newUrlInfo] =
                context.referenceUtils.updateSpecifier(specifier, newSpecifier)
              newReference.expectedType = "js_classic"
              removeHtmlNodeAttribute(node, typeAttribute)
              srcAttribute.value = newReference.generatedSpecifier
              jsModulesToWait.push({
                reference: newReference,
                urlInfo: newUrlInfo,
              })
            })
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          actions.push(async () => {
            const { line, column, lineEnd, columnEnd, isOriginal } =
              htmlNodePosition.readNodePosition(node, {
                preferOriginal: true,
              })
            let inlineScriptUrl = generateInlineContentUrl({
              url: urlInfo.url,
              extension: ".js",
              line,
              column,
              lineEnd,
              columnEnd,
            })
            const [inlineScriptReference, inlineScriptUrlInfo] =
              context.referenceUtils.foundInline({
                node,
                type: "script_src",
                expectedType: "js_module",
                // we remove 1 to the line because imagine the following html:
                // <script>console.log('ok')</script>
                // -> content starts same line as <script>
                line: line - 1,
                column,
                isOriginal,
                specifier: inlineScriptUrl,
                contentType: "application/javascript",
                content: textNode.value,
              })
            await context.cook({
              reference: inlineScriptReference,
              urlInfo: inlineScriptUrlInfo,
            })
            removeHtmlNodeAttribute(node, typeAttribute)
            setHtmlNodeText(node, inlineScriptUrlInfo.content)
            jsModulesToWait.push({
              reference: inlineScriptReference,
              urlInfo: inlineScriptUrlInfo,
            })
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          visitScriptTypeModule(node)
        })
        if (actions.length === 0) {
          return null
        }
        await Promise.all(actions.map((action) => action()))
        if (systemJsInjection) {
          await Promise.all(
            jsModulesToWait.map(async (jsModuleToWait) => {
              await context.cook({
                reference: jsModuleToWait.reference,
                urlInfo: jsModuleToWait.urlInfo,
              })
            }),
          )
          const needsSystemJs = jsModulesToWait.some(
            (jsModuleToWait) => jsModuleToWait.urlInfo.data.format === "system",
          )
          if (needsSystemJs) {
            const [systemJsReference] = context.referenceUtils.inject({
              type: "script_src",
              expectedType: "js_classic",
              specifier: systemJsClientFileUrl,
            })
            injectScriptAsEarlyAsPossible(
              htmlAst,
              createHtmlNode({
                "tagName": "script",
                "src": systemJsReference.generatedSpecifier,
                "injected-by": "jsenv:js_module_as_js_classic",
              }),
            )
          }
        }
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}

export const generateJsClassicFilename = (url) => {
  const filename = urlToFilename(url)
  const [basename, extension] = splitFileExtension(filename)
  return `${basename}.es5${extension}`
}

const splitFileExtension = (filename) => {
  const dotLastIndex = filename.lastIndexOf(".")
  if (dotLastIndex === -1) {
    return [filename, ""]
  }
  return [filename.slice(0, dotLastIndex), filename.slice(dotLastIndex)]
}

// TODO: handle also service worker and shared worker in this plugin
const workersTypeModuleAsClassic = () => {
  const transformJsWorkerTypes = async (urlInfo, context) => {
    const usesWorkerTypeModule = urlInfo.references.some(
      (ref) =>
        ref.expectedType === "js_module" && ref.expectedSubtype === "worker",
    )
    if (!usesWorkerTypeModule) {
      return null
    }
    if (context.isSupportedOnCurrentClients("worker_type_module")) {
      return null
    }
    const { metadata } = await applyBabelPlugins({
      babelPlugins: [babelPluginMetadataNewWorkerMentions],
      urlInfo,
    })
    const { newWorkerMentions } = metadata
    const magicSource = createMagicSource(urlInfo.content)
    newWorkerMentions.forEach((newWorkerMention) => {
      if (newWorkerMention.expectedType !== "js_module") {
        return
      }
      const specifier = newWorkerMention.specifier
      // during dev/test, browser will do the fetch
      // during build it's a bit different
      const newSpecifier = injectQueryParamsIntoSpecifier(specifier, {
        as_js_classic: "",
      })
      const [newReference] = context.referenceUtils.updateSpecifier(
        JSON.stringify(specifier),
        newSpecifier,
      )
      magicSource.replace({
        start: newWorkerMention.start,
        end: newWorkerMention.end,
        replacement: newReference.generatedSpecifier,
      })
      magicSource.replace({
        start: newWorkerMention.typeArgNode.value.start,
        end: newWorkerMention.typeArgNode.value.end,
        replacement: JSON.stringify("classic"),
      })
    })
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:workers_type_module_as_classic",
    appliesDuring: "*",
    transform: {
      js_module: transformJsWorkerTypes,
      js_classic: transformJsWorkerTypes,
    },
  }
}

const babelPluginMetadataNewWorkerMentions = () => {
  return {
    name: "metadata-new-worker-mentions",
    visitor: {
      Program(programPath, state) {
        const newWorkerMentions = []
        programPath.traverse({
          NewExpression: (path) => {
            const mentions = analyzeNewWorkerCall(path)
            if (mentions) {
              newWorkerMentions.push(...mentions)
            }
          },
        })
        state.file.metadata.newWorkerMentions = newWorkerMentions
      },
    },
  }
}

const topLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    transform: {
      js_module: async (urlInfo, context) => {
        if (!urlInfo.data.usesTopLevelAwait) {
          return null
        }
        if (context.isSupportedOnCurrentClients("top_level_await")) {
          return null
        }
        const { code, map } = await applyBabelPlugins({
          urlInfo,
          babelPlugins: [
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
              },
            ],
          ],
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}
