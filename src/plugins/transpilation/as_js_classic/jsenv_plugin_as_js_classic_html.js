/*
 * when <script type="module"> cannot be used:
 * - ?as_js_classic is injected into the src of <script type="module">
 * - js inside <script type="module"> is transformed into classic js
 * - <link rel="modulepreload"> are converted to <link rel="preload">
 */

import { readFileSync } from "node:fs"
import {
  parseHtmlString,
  visitHtmlNodes,
  stringifyHtmlAst,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  analyzeScriptNode,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"
import { injectQueryParams } from "@jsenv/urls"

export const jsenvPluginAsJsClassicHtml = ({
  systemJsInjection,
  systemJsClientFileUrl,
}) => {
  let shouldTransformScriptTypeModule

  const turnIntoJsClassicProxy = (reference) => {
    return injectQueryParams(reference.url, { as_js_classic: "" })
  }

  return {
    name: "jsenv:as_js_classic_html",
    appliesDuring: "*",
    init: (context) => {
      shouldTransformScriptTypeModule =
        !context.isSupportedOnCurrentClients("script_type_module") ||
        !context.isSupportedOnCurrentClients("import_dynamic") ||
        !context.isSupportedOnCurrentClients("import_meta")
    },
    redirectUrl: {
      link_href: (reference) => {
        if (
          shouldTransformScriptTypeModule &&
          reference.subtype === "modulepreload"
        ) {
          return turnIntoJsClassicProxy(reference)
        }
        if (
          shouldTransformScriptTypeModule &&
          reference.subtype === "preload" &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference)
        }
        return null
      },
      script_src: (reference) => {
        if (
          shouldTransformScriptTypeModule &&
          reference.expectedType === "js_module"
        ) {
          return turnIntoJsClassicProxy(reference)
        }
        return null
      },
    },
    finalizeUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content)
        const mutations = []
        visitHtmlNodes(htmlAst, {
          link: (node) => {
            const rel = getHtmlNodeAttribute(node, "rel")
            if (rel !== "modulepreload" && rel !== "preload") {
              return
            }
            const href = getHtmlNodeAttribute(node, "href")
            if (!href) {
              return
            }
            const reference = context.referenceUtils.find(
              (ref) =>
                ref.generatedSpecifier === href &&
                ref.type === "link_href" &&
                ref.subtype === rel,
            )
            if (!isOrWasExpectingJsModule(reference)) {
              return
            }
            if (rel === "modulepreload") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, {
                  rel: "preload",
                  as: "script",
                  crossorigin: undefined,
                })
              })
            }
            if (rel === "preload") {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { crossorigin: undefined })
              })
            }
          },
          script: (node) => {
            const { type } = analyzeScriptNode(node)
            if (type !== "js_module") {
              return
            }
            const src = getHtmlNodeAttribute(node, "src")
            if (src) {
              const reference = context.referenceUtils.find(
                (ref) =>
                  ref.generatedSpecifier === src &&
                  ref.type === "script_src" &&
                  ref.subtype === "js_module",
              )
              if (!reference) {
                return
              }
              if (reference.expectedType === "js_classic") {
                mutations.push(() => {
                  setHtmlNodeAttributes(node, { type: undefined })
                })
              }
            } else if (shouldTransformScriptTypeModule) {
              mutations.push(() => {
                setHtmlNodeAttributes(node, { type: undefined })
              })
            }
          },
        })

        if (systemJsInjection) {
          let needsSystemJs = false
          for (const reference of urlInfo.references) {
            if (reference.isResourceHint) {
              // we don't cook resource hints
              // because they might refer to resource that will be modified during build
              // It also means something else HAVE to reference that url in order to cook it
              // so that the preload is deleted by "resync_resource_hints.js" otherwise
              continue
            }
            if (isOrWasExpectingJsModule(reference)) {
              const dependencyUrlInfo = context.urlGraph.getUrlInfo(
                reference.url,
              )
              try {
                await context.cook(dependencyUrlInfo, { reference })
                if (dependencyUrlInfo.data.jsClassicFormat === "system") {
                  needsSystemJs = true
                  break
                }
              } catch (e) {
                if (context.scenarios.dev) {
                  // ignore cooking error, the browser will trigger it again on fetch
                } else {
                  throw e
                }
              }
            }
          }
          if (needsSystemJs) {
            mutations.push(async () => {
              const systemJsFileContent = readFileSync(
                new URL(systemJsClientFileUrl),
                { encoding: "utf8" },
              )
              const [systemJsReference, systemJsUrlInfo] =
                context.referenceUtils.inject({
                  type: "script_src",
                  expectedType: "js_classic",
                  isInline: true,
                  contentType: "text/javascript",
                  content: systemJsFileContent,
                  specifier: "s.js",
                })
              await context.cook(systemJsUrlInfo, {
                reference: systemJsReference,
              })
              injectScriptNodeAsEarlyAsPossible(
                htmlAst,
                createHtmlNode({
                  tagName: "script",
                  textContent: systemJsUrlInfo.content,
                }),
                "jsenv:as_js_classic_html",
              )
            })
          }
        }
        if (mutations.length === 0) {
          return null
        }
        await Promise.all(mutations.map((mutation) => mutation()))
        return stringifyHtmlAst(htmlAst)
      },
    },
  }
}

const isOrWasExpectingJsModule = (reference) => {
  if (isExpectingJsModule(reference)) {
    return true
  }
  if (reference.original && isExpectingJsModule(reference.original)) {
    return true
  }
  return false
}

const isExpectingJsModule = (reference) => {
  return (
    reference.expectedType === "js_module" ||
    reference.searchParams.has("as_js_classic") ||
    reference.searchParams.has("as_js_classic_library")
  )
}
