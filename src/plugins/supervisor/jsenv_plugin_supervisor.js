/*
 * Jsenv needs to wait for all js execution inside an HTML page before killing the browser.
 * A naive approach would consider execution done when "load" event is dispatched on window but:
 *
 * scenario                                    | covered by window "load"
 * ------------------------------------------- | -------------------------
 * js referenced by <script src>               | yes
 * js inlined into <script>                    | yes
 * js referenced by <script type="module" src> | partially (not for import and top level await)
 * js inlined into <script type="module">      | not at all
 *
 * This plugin provides a way for jsenv to know when js execution is done
 * As a side effect this plugin enables ability to hot reload js inlined into <script hot-accept>
 *
 * TODO: do it this way instead (to repect code execution)
 * <script src="file.js">
 * becomes
 * <script supervised-src="file.js">
 *   window.__supervisor__.superviseScript(document.currentScript)
 * </script>
 *
 * <script>
 *    console.log(42)
 * </script>
 * becomes
 * <script supervised-src="main.html@L10-L13.js>
 *   window.__supervisor__.superviseScript(document.currentScript)
 * </script>
 *
 * <script type="module" src="module.js"></script>
 * becomes
 * <script type="module" supervised-src="module.js">
 *   import { superviseScriptTypeModule } from 'supervisor'
 *   superviseScriptTypeModule({
 *     src: "module.js"
 *   })
 * </script>
 *
 * And same logic for inline <script type="module">
 */

import { fileURLToPath } from "node:url"
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  analyzeScriptNode,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
  getHtmlNodePosition,
  getHtmlNodeText,
  removeHtmlNodeText,
  setHtmlNodeText,
} from "@jsenv/ast"
import { generateInlineContentUrl, stringifyUrlSite } from "@jsenv/urls"
import { getOriginalPosition } from "@jsenv/sourcemap"

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"

export const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl,
}) => {
  const supervisorFileUrl = new URL(
    "./client/supervisor.js?js_classic",
    import.meta.url,
  ).href
  const scriptTypeModuleSupervisorFileUrl = new URL(
    "./client/script_type_module_supervisor.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async (request, context) => {
      if (request.pathname.startsWith("/__get_code_frame__/")) {
        const { pathname, searchParams } = new URL(request.url)
        const urlWithLineAndColumn = pathname.slice(
          "/__get_code_frame__/".length,
        )
        const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/)
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url",
          }
        }
        const file = urlWithLineAndColumn.slice(0, match.index)
        let line = parseInt(match[1])
        let column = parseInt(match[2])
        const urlInfo = context.urlGraph.getUrlInfo(file)
        if (!urlInfo) {
          return {
            status: 404,
          }
        }
        const remap = searchParams.has("remap")
        if (remap) {
          const sourcemap = urlInfo.sourcemap
          if (sourcemap) {
            const original = await getOriginalPosition({
              sourcemap,
              url: file,
              line,
              column,
            })
            line = original.line
            column = original.column
          }
        }
        const codeFrame = stringifyUrlSite({
          url: file,
          line,
          column,
          content: urlInfo.originalContent,
        })
        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(codeFrame),
          },
          body: codeFrame,
        }
      }
      if (request.pathname.startsWith("/__get_error_cause__/")) {
        const file = request.pathname.slice("/__get_error_cause__/".length)
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          }
        }
        const getErrorCauseInfo = () => {
          const urlInfo = context.urlGraph.getUrlInfo(file)
          if (!urlInfo) {
            return null
          }
          const { error } = urlInfo
          if (error) {
            return error
          }
          // search in direct dependencies (404 or 500)
          const { dependencies } = urlInfo
          for (const dependencyUrl of dependencies) {
            const dependencyUrlInfo = context.urlGraph.getUrlInfo(dependencyUrl)
            if (dependencyUrlInfo.error) {
              return dependencyUrlInfo.error
            }
          }
          return null
        }
        const causeInfo = getErrorCauseInfo()
        const body = JSON.stringify(
          causeInfo
            ? {
                code: causeInfo.code,
                message: causeInfo.message,
                reason: causeInfo.reason,
                stack: errorBaseUrl
                  ? `stack mocked for snapshot`
                  : causeInfo.stack,
                codeFrame: causeInfo.traceMessage,
              }
            : null,
          null,
          "  ",
        )
        return {
          status: 200,
          headers: {
            "cache-control": "no-cache",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      }
      if (request.pathname.startsWith("/__open_in_editor__/")) {
        const file = request.pathname.slice("/__open_in_editor__/".length)
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          }
        }
        const launch = requireFromJsenv("launch-editor")
        launch(fileURLToPath(file), () => {
          // ignore error for now
        })
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
          },
        }
      }
      return null
    },
    transformUrlContent: {
      html: ({ url, content }, context) => {
        const htmlAst = parseHtmlString(content)
        const scriptsToSupervise = []

        const handleInlineScript = (node, htmlNodeText) => {
          const { type, extension } = analyzeScriptNode(node)
          const { line, column, lineEnd, columnEnd, isOriginal } =
            getHtmlNodePosition(node, {
              preferOriginal: true,
            })
          let inlineScriptUrl = generateInlineContentUrl({
            url,
            extension: extension || ".js",
            line,
            column,
            lineEnd,
            columnEnd,
          })
          const [inlineScriptReference] = context.referenceUtils.foundInline({
            type: "script_src",
            expectedType: type,
            isOriginalPosition: isOriginal,
            specifierLine: line - 1,
            specifierColumn: column,
            specifier: inlineScriptUrl,
            contentType: "text/javascript",
            content: htmlNodeText,
          })
          removeHtmlNodeText(node)
          if (extension) {
            setHtmlNodeAttributes(node, {
              type: type === "js_module" ? "module" : undefined,
            })
          }
          scriptsToSupervise.push({
            node,
            isInline: true,
            type,
            src: inlineScriptReference.generatedSpecifier,
          })
        }
        const handleScriptWithSrc = (node, src) => {
          const { type } = analyzeScriptNode(node)
          const integrity = getHtmlNodeAttribute(node, "integrity")
          const crossorigin =
            getHtmlNodeAttribute(node, "crossorigin") !== undefined
          const defer = getHtmlNodeAttribute(node, "defer") !== undefined
          const async = getHtmlNodeAttribute(node, "async") !== undefined
          setHtmlNodeAttributes(node, {
            src: undefined,
          })
          scriptsToSupervise.push({
            node,
            type,
            src,
            defer,
            async,
            integrity,
            crossorigin,
          })
        }
        visitHtmlNodes(htmlAst, {
          script: (node) => {
            const { type } = analyzeScriptNode(node)
            if (type !== "js_classic" && type !== "js_module") {
              return
            }
            const injectedBy = getHtmlNodeAttribute(node, "injected-by")
            if (injectedBy !== undefined) {
              return
            }
            const noHtmlSupervisor = getHtmlNodeAttribute(
              node,
              "no-html-supervisor",
            )
            if (noHtmlSupervisor !== undefined) {
              return
            }
            const htmlNodeText = getHtmlNodeText(node)
            if (htmlNodeText) {
              handleInlineScript(node, htmlNodeText)
              return
            }
            const src = getHtmlNodeAttribute(node, "src")
            if (src) {
              handleScriptWithSrc(node, src)
              return
            }
          },
        })
        const [scriptTypeModuleSupervisorFileReference] =
          context.referenceUtils.inject({
            type: "js_import_export",
            expectedType: "js_module",
            specifier: scriptTypeModuleSupervisorFileUrl,
          })
        const [supervisorFileReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_classic",
          specifier: supervisorFileUrl,
        })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "injected-by": "jsenv:supervisor",
            "tagName": "script",
            "src": supervisorFileReference.generatedSpecifier,
          }),
        )
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "injected-by": "jsenv:supervisor",
            "tagName": "script",
            "textContent": `
      window.__supervisor__.setup(${JSON.stringify(
        {
          rootDirectoryUrl: context.rootDirectoryUrl,
          errorBaseUrl,
          logs,
          measurePerf,
          errorOverlay,
          openInEditor,
        },
        null,
        "        ",
      )})
    `,
          }),
        )

        scriptsToSupervise.forEach(
          ({
            node,
            isInline,
            type,
            src,
            defer,
            async,
            integrity,
            crossorigin,
          }) => {
            setHtmlNodeText(
              node,
              generateCodeToSuperviseScript({
                type,
                src,
                isInline,
                defer,
                async,
                integrity,
                crossorigin,
                scriptTypeModuleSupervisorSpecifier:
                  scriptTypeModuleSupervisorFileReference.generatedSpecifier,
              }),
            )
            setHtmlNodeAttributes(node, {
              "generated-by": "jsenv:supervisor",
              ...(src ? { "generated-from-src": src } : {}),
              ...(isInline ? { "generated-from-inline-content": "" } : {}),
            })
          },
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
}

// Ideally jsenv should take into account eventual
// "integrity" and "crossorigin" attribute during supervision
const generateCodeToSuperviseScript = ({
  type,
  src,
  isInline,
  defer,
  async,
  integrity,
  crossorigin,
  scriptTypeModuleSupervisorSpecifier,
}) => {
  const paramsAsJson = JSON.stringify({
    src,
    isInline,
    defer,
    async,
    integrity,
    crossorigin,
  })
  if (type === "js_module") {
    return `
      import { superviseScriptTypeModule } from ${scriptTypeModuleSupervisorSpecifier}
      superviseScriptTypeModule(${paramsAsJson})
`
  }
  return `
      window.__supervisor__.superviseScript(${paramsAsJson})
`
}
