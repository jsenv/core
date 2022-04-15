import { createRequire } from "node:module"
import { readFileSync } from "@jsenv/filesystem"

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

export const jsenvPluginJsModuleAsJsClassic = ({
  systemJsInjection = true,
} = {}) => {
  const systemJsClientFileUrl = new URL("./client/s.js", import.meta.url).href

  const convertJsModuleToJsClassic = async (urlInfo, outFormat) => {
    const { code, map } = await applyBabelPlugins({
      babelPlugins: [
        ...(outFormat === "system"
          ? [
              // propposal-dynamic-import required with systemjs for babel8:
              // https://github.com/babel/babel/issues/10746
              require("@babel/plugin-proposal-dynamic-import"),
              require("@babel/plugin-transform-modules-systemjs"),
            ]
          : [
              require("@babel/plugin-transform-modules-umd"),
              babelPluginTransformImportMetaUrl,
            ]),
      ],
      url: urlInfo.data.rawUrl || urlInfo.url,
      generatedUrl: urlInfo.generatedUrl,
      content: urlInfo.content,
    })
    urlInfo.type = "js_classic"
    urlInfo.data.format = outFormat
    if (
      systemJsInjection &&
      outFormat === "system" &&
      (urlInfo.data.isEntryPoint ||
        urlInfo.subtype === "worker" ||
        urlInfo.subtype === "service_worker")
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
    name: "jsenv:js_module_as_js_classic",
    appliesDuring: "*",
    // forward ?as_js_classic to referenced urls
    normalize: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo || !parentUrlInfo.data.asJsClassic) {
        return null
      }
      const urlTransformed = injectQueryParams(reference.url, {
        as_js_classic: "",
      })
      return urlTransformed
    },
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
              const [newReference, newUrlInfo] =
                context.referenceUtils.updateSpecifier(specifier, newSpecifier)
              newUrlInfo.data.asJsClassic = true
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
              specifier: injectQueryParams(systemJsClientFileUrl, {
                js_classic: "",
              }),
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
      js_module: async (urlInfo, context) => {
        if (
          // during build the info must be read from "data.asJsClassic"
          // because the specifier becomes "worker.es5.js" without query param
          urlInfo.data.asJsClassic ||
          new URL(urlInfo.url).searchParams.has("as_js_classic")
        ) {
          urlInfo.data.asJsClassic = true
          const outFormat =
            urlInfo.data.usesImport || urlInfo.data.usesExport
              ? "system"
              : "umd"
          const classicConversionResult = await convertJsModuleToJsClassic(
            urlInfo,
            outFormat,
          )
          return classicConversionResult
        }
        const usesWorkerTypeModule = urlInfo.references.some(
          (ref) =>
            ref.expectedSubtype === "worker" &&
            ref.expectedType === "js_module",
        )
        if (
          !usesWorkerTypeModule ||
          context.isSupportedOnCurrentClients("worker_type_module")
        ) {
          return null
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataNewWorkerMentions],
          url: urlInfo.url,
          generatedUrl: urlInfo.generatedUrl,
          content: urlInfo.content,
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
          const [newReference, newUrlInfo] =
            context.referenceUtils.updateSpecifier(
              JSON.stringify(specifier),
              newSpecifier,
            )
          newUrlInfo.data.asJsClassic = true
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
      },
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
