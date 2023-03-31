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

const supervisorFileUrl = new URL("./client/supervisor.js", import.meta.url)
  .href

export const injectSupervisorIntoHTML = (
  { content, url },
  {
    supervisorScriptSrc = supervisorFileUrl,
    supervisorSetupParams,
    generateInlineScriptSrc = ({ inlineScriptUrl }) => inlineScriptUrl,
  } = {},
) => {
  const htmlAst = parseHtmlString(content)
  const scriptsToSupervise = []

  const handleInlineScript = (scriptNode, { type, extension, textContent }) => {
    const { line, column, lineEnd, columnEnd, isOriginal } =
      getHtmlNodePosition(scriptNode, { preferOriginal: true })
    const inlineScriptUrl = generateInlineContentUrl({
      url,
      extension: extension || ".js",
      line,
      column,
      lineEnd,
      columnEnd,
    })
    const inlineScriptSrc = generateInlineScriptSrc({
      textContent,
      inlineScriptUrl,
      isOriginal,
      line,
      column,
    })
    removeHtmlNodeText(scriptNode)
    if (extension) {
      setHtmlNodeAttributes(scriptNode, {
        type: type === "js_module" ? "module" : undefined,
      })
    }
    scriptsToSupervise.push({
      node: scriptNode,
      isInline: true,
      type,
      src: inlineScriptSrc,
    })
  }
  const handleScriptWithSrc = (scriptNode, { type, src }) => {
    const integrity = getHtmlNodeAttribute(scriptNode, "integrity")
    const crossorigin =
      getHtmlNodeAttribute(scriptNode, "crossorigin") !== undefined
    const defer = getHtmlNodeAttribute(scriptNode, "defer") !== undefined
    const async = getHtmlNodeAttribute(scriptNode, "async") !== undefined
    scriptsToSupervise.push({
      node: scriptNode,
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
      const { type, extension } = analyzeScriptNode(node)
      if (type !== "js_classic" && type !== "js_module") {
        return
      }
      if (
        getHtmlNodeAttribute(node, "jsenv-cooked-by") ||
        getHtmlNodeAttribute(node, "jsenv-inlined-by") ||
        getHtmlNodeAttribute(node, "jsenv-injected-by")
      ) {
        return
      }
      const noSupervisor = getHtmlNodeAttribute(node, "no-supervisor")
      if (noSupervisor !== undefined) {
        return
      }
      const htmlNodeText = getHtmlNodeText(node)
      if (htmlNodeText) {
        handleInlineScript(node, { type, extension, textContent: htmlNodeText })
        return
      }
      const src = getHtmlNodeAttribute(node, "src")
      if (src) {
        handleScriptWithSrc(node, { type, src })
        return
      }
    },
  })

  // here I know the scripts I want to supervise
  // in other words I can tell that to the supervisor
  // so that it awaits exactly the scripts that are referenced in HTML
  // instead of being dynamic

  injectScriptNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: `
    window.__supervisor__.setup(${JSON.stringify(
      {
        ...supervisorSetupParams,
        jsUrls: scriptsToSupervise.map((jsScriptInfo) => jsScriptInfo.src),
      },
      null,
      "        ",
    )})
    `,
    }),
    "jsenv:supervisor",
  )
  injectScriptNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({ tagName: "script", src: supervisorScriptSrc }),
    "jsenv:supervisor",
  )

  scriptsToSupervise.forEach(
    ({ node, isInline, type, src, defer, async, integrity, crossorigin }) => {
      setHtmlNodeText(
        node,
        generateCodeToSuperviseJs({
          type,
          src,
          isInline,
          defer,
          async,
          integrity,
          crossorigin,
        }),
      )
      if (src) {
        setHtmlNodeAttributes(node, {
          "jsenv-inlined-by": "jsenv:supervisor",
          "src": undefined,
          "inlined-from-src": src,
        })
      } else {
        setHtmlNodeAttributes(node, {
          "jsenv-cooked-by": "jsenv:supervisor",
        })
      }
    },
  )
  const htmlModified = stringifyHtmlAst(htmlAst)
  return {
    content: htmlModified,
  }
}

const generateCodeToSuperviseJs = ({
  type,
  src,
  isInline,
  defer,
  async,
  integrity,
  crossorigin,
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
    const jsModuleInfo = ${paramsAsJson};
    window.__supervisor__.superviseScriptTypeModule(jsModuleInfo, (url) => import(url));
    `
  }
  return `
    const jsClassicInfo = ${paramsAsJson};
    window.__supervisor__.superviseScript(jsClassicInfo);
    `
}
