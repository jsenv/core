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
import { generateInlineContentUrl } from "@jsenv/urls"

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
    serve: (request) => {
      if (!request.ressource.startsWith("/__open_in_editor__/")) {
        return null
      }
      const file = request.ressource.slice("/__open_in_editor__/".length)
      if (!file) {
        return {
          status: 400,
          body: 'Missing "file" in url search params',
        }
      }
      const launch = requireFromJsenv("launch-editor")
      launch(fileURLToPath(file), () => {
        // ignore error for now
      })
      return {
        status: 200,
      }
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
          errorBaseUrl: errorBaseUrl || context.rootDirectoryUrl,
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
