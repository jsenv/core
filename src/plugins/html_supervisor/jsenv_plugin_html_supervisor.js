/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
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

import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"

export const jsenvPluginHtmlSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl,
}) => {
  const htmlSupervisorSetupFileUrl = new URL(
    "./client/html_supervisor_setup.js?js_classic",
    import.meta.url,
  ).href

  const htmlSupervisorInstallerFileUrl = new URL(
    "./client/html_supervisor_installer.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:html_supervisor",
    appliesDuring: {
      dev: true,
      test: true,
    },
    serve: (request, context) => {
      if (request.ressource.startsWith("/__get_code_frame__/")) {
        const url = request.ressource.slice("/__get_code_frame__/".length)
        const match = url.match(/:([0-9]+):([0-9]+)$/)
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url",
          }
        }
        const file = url.slice(0, match.index)
        const line = parseInt(match[1])
        const column = parseInt(match[2])
        const urlInfo = context.urlGraph.getUrlInfo(file)
        if (!urlInfo) {
          return {
            status: 404,
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
      if (request.ressource.startsWith("/__get_error_cause__/")) {
        const file = request.ressource.slice("/__get_error_cause__/".length)
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
                stack: causeInfo.stack,
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
      if (request.ressource.startsWith("/__open_in_editor__/")) {
        const file = request.ressource.slice("/__open_in_editor__/".length)
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
        const [htmlSupervisorInstallerFileReference] =
          context.referenceUtils.inject({
            type: "js_import_export",
            expectedType: "js_module",
            specifier: htmlSupervisorInstallerFileUrl,
          })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "textContent": `
      import { installHtmlSupervisor } from ${
        htmlSupervisorInstallerFileReference.generatedSpecifier
      }
      installHtmlSupervisor(${JSON.stringify(
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
      )})`,
            "injected-by": "jsenv:html_supervisor",
          }),
        )
        const [htmlSupervisorSetupFileReference] =
          context.referenceUtils.inject({
            type: "script_src",
            expectedType: "js_classic",
            specifier: htmlSupervisorSetupFileUrl,
          })
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "src": htmlSupervisorSetupFileReference.generatedSpecifier,
            "injected-by": "jsenv:html_supervisor",
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
                htmlSupervisorInstallerSpecifier:
                  htmlSupervisorInstallerFileReference.generatedSpecifier,
              }),
            )
            setHtmlNodeAttributes(node, {
              "generated-by": "jsenv:html_supervisor",
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
  htmlSupervisorInstallerSpecifier,
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
      import { superviseScriptTypeModule } from ${htmlSupervisorInstallerSpecifier}
      superviseScriptTypeModule(${paramsAsJson})
`
  }
  return `
      window.__html_supervisor__.superviseScript(${paramsAsJson})
`
}
