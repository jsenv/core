/*
 * Things happening here
 * - html supervisor module injection
 * - scripts are wrapped to be supervised
 */

import { urlIsInsideOf } from "@jsenv/filesystem"

import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlAst,
  getHtmlNodeAttributeByName,
  removeHtmlNodeAttributeByName,
  parseScriptNode,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  htmlNodePosition,
  getHtmlNodeTextNode,
  removeHtmlNodeText,
  setHtmlNodeGeneratedText,
} from "@jsenv/utils/html_ast/html_ast.js"
import { generateInlineContentUrl } from "@jsenv/utils/urls/inline_content_url_generator.js"
import { jsenvRootDirectoryUrl } from "@jsenv/core/src/jsenv_root_directory_url.js"

export const jsenvPluginHtmlSupervisor = ({
  rootDirectoryUrl,
  logs = false,
  measurePerf = false,
}) => {
  const preferSourceFiles =
    rootDirectoryUrl === jsenvRootDirectoryUrl ||
    urlIsInsideOf(rootDirectoryUrl, jsenvRootDirectoryUrl)
  const htmlSupervisorSetupFileUrl = preferSourceFiles
    ? new URL("./client/html_supervisor_setup.js", import.meta.url).href
    : new URL("./dist/html_supervisor_setup.js", jsenvRootDirectoryUrl).href
  const htmlSupervisorInstallerFileUrl = preferSourceFiles
    ? new URL("./client/html_supervisor_installer.js", import.meta.url).href
    : new URL("./dist/html_supervisor_installer.js", jsenvRootDirectoryUrl).href

  return {
    name: "jsenv:html_supervisor",
    appliesDuring: {
      dev: true,
      test: true,
    },
    transformUrlContent: {
      html: ({ url, content }, { referenceUtils }) => {
        const htmlAst = parseHtmlString(content)
        const scriptsToSupervise = []

        const handleInlineScript = (node, textNode) => {
          const scriptCategory = parseScriptNode(node)
          const { line, column, lineEnd, columnEnd, isOriginal } =
            htmlNodePosition.readNodePosition(node, {
              preferOriginal: true,
            })
          let inlineScriptUrl = generateInlineContentUrl({
            url,
            extension: ".js",
            line,
            column,
            lineEnd,
            columnEnd,
          })
          const [inlineScriptReference] = referenceUtils.foundInline({
            type: "script_src",
            expectedType: { classic: "js_classic", module: "js_module" }[
              scriptCategory
            ],
            isOriginalPosition: isOriginal,
            specifierLine: line - 1,
            specifierColumn: column,
            specifier: inlineScriptUrl,
            contentType: "text/javascript",
            content: textNode.value,
          })
          removeHtmlNodeText(node)
          scriptsToSupervise.push({
            node,
            isInline: true,
            type: scriptCategory,
            src: inlineScriptReference.generatedSpecifier,
          })
        }
        const handleScriptWithSrc = (node, srcAttribute) => {
          const scriptCategory = parseScriptNode(node)
          const integrityAttribute = getHtmlNodeAttributeByName(
            node,
            "integrity",
          )
          const integrity = integrityAttribute
            ? integrityAttribute.value
            : undefined
          const crossoriginAttribute = getHtmlNodeAttributeByName(
            node,
            "crossorigin",
          )
          const crossorigin = crossoriginAttribute
            ? crossoriginAttribute.value
            : undefined
          const deferAttribute = getHtmlNodeAttributeByName(node, "crossorigin")
          const defer = deferAttribute ? deferAttribute.value : undefined
          const asyncAttribute = getHtmlNodeAttributeByName(node, "crossorigin")
          const async = asyncAttribute ? asyncAttribute.value : undefined
          removeHtmlNodeAttributeByName(node, "src")
          scriptsToSupervise.push({
            node,
            type: scriptCategory,
            src: srcAttribute.value,
            defer,
            async,
            integrity,
            crossorigin,
          })
        }
        visitHtmlAst(htmlAst, (node) => {
          if (node.nodeName !== "script") {
            return
          }
          const scriptCategory = parseScriptNode(node)
          if (scriptCategory !== "classic" && scriptCategory !== "module") {
            return
          }
          const injectedByAttribute = getHtmlNodeAttributeByName(
            node,
            "injected-by",
          )
          if (injectedByAttribute) {
            return
          }
          const noHtmlSupervisor = getHtmlNodeAttributeByName(
            node,
            "no-html-supervisor",
          )
          if (noHtmlSupervisor) {
            return
          }
          const textNode = getHtmlNodeTextNode(node)
          if (textNode) {
            handleInlineScript(node, textNode)
            return
          }
          const srcAttribute = getHtmlNodeAttributeByName(node, "src")
          if (srcAttribute) {
            handleScriptWithSrc(node, srcAttribute)
            return
          }
        })
        const [htmlSupervisorInstallerFileReference] = referenceUtils.inject({
          type: "js_import_export",
          expectedType: "js_module",
          specifier: htmlSupervisorInstallerFileUrl,
        })
        injectScriptAsEarlyAsPossible(
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
          logs,
          measurePerf,
        },
        null,
        "        ",
      )})`,
            "injected-by": "jsenv:html_supervisor",
          }),
        )
        const [htmlSupervisorSetupFileReference] = referenceUtils.inject({
          type: "script_src",
          expectedType: "js_classic",
          specifier: htmlSupervisorSetupFileUrl,
        })
        injectScriptAsEarlyAsPossible(
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
            setHtmlNodeGeneratedText(node, {
              generatedText: generateCodeToSuperviseScript({
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
              generatedBy: "jsenv:html_supervisor",
              generatedFromSrc: src,
              generatedFromInlineContent: isInline,
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
  if (type === "module") {
    return `
      import { superviseScriptTypeModule } from ${htmlSupervisorInstallerSpecifier}
      superviseScriptTypeModule(${paramsAsJson})
`
  }
  return `
      window.__html_supervisor__.superviseScript(${paramsAsJson})
`
}
