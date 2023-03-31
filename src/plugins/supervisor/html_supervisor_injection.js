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
  setHtmlNodeText,
} from "@jsenv/ast"
import {
  generateInlineContentUrl,
  urlToRelativeUrl,
  urlToFilename,
} from "@jsenv/urls"

import { injectSupervisorIntoJs } from "./js_supervisor_injection.js"

const supervisorFileUrl = new URL("./client/supervisor.js", import.meta.url)
  .href

export const injectSupervisorIntoHTML = async (
  { content, url },
  {
    webServer,
    supervisorScriptSrc = supervisorFileUrl,
    generateInlineScriptSrc = ({ inlineScriptUrl }) =>
      urlToRelativeUrl(inlineScriptUrl, webServer.rootDirectoryUrl),
  },
) => {
  const htmlAst = parseHtmlString(content)
  const mutations = []
  const actions = []

  const scriptInfos = []
  // 1. Find inline and remote scripts
  {
    const handleInlineScript = (
      scriptNode,
      { type, extension, textContent },
    ) => {
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
      scriptInfos.push({ type, isInline: true, src: inlineScriptSrc })
      actions.push(async () => {
        const inlineJsSupervised = await injectSupervisorIntoJs({
          content: textContent,
          url: inlineScriptUrl,
          filename: urlToFilename(inlineScriptUrl),
          type,
        })
        mutations.push(() => {
          setHtmlNodeText(scriptNode, `\n${inlineJsSupervised}\n`)
          setHtmlNodeAttributes(scriptNode, {
            "jsenv-cooked-by": "jsenv:supervisor",
          })
        })
      })
    }
    const handleScriptWithSrc = (scriptNode, { type, src }) => {
      scriptInfos.push({ type, id: src })
      const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
        type,
        src,
      })
      mutations.push(() => {
        setHtmlNodeText(scriptNode, remoteJsSupervised)
      })
    }
    visitHtmlNodes(htmlAst, {
      script: (scriptNode) => {
        const { type, extension } = analyzeScriptNode(scriptNode)
        if (type !== "js_classic" && type !== "js_module") {
          return
        }
        if (
          getHtmlNodeAttribute(scriptNode, "jsenv-cooked-by") ||
          getHtmlNodeAttribute(scriptNode, "jsenv-inlined-by") ||
          getHtmlNodeAttribute(scriptNode, "jsenv-injected-by")
        ) {
          return
        }
        const noSupervisor = getHtmlNodeAttribute(scriptNode, "no-supervisor")
        if (noSupervisor !== undefined) {
          return
        }
        const scriptNodeText = getHtmlNodeText(scriptNode)
        if (scriptNodeText) {
          handleInlineScript(scriptNode, {
            type,
            extension,
            textContent: scriptNodeText,
          })
          return
        }
        const src = getHtmlNodeAttribute(scriptNode, "src")
        if (src) {
          handleScriptWithSrc(scriptNode, { type, src })
          return
        }
      },
    })
  }
  // 2. Inject supervisor js file + setup call
  {
    const setupParamsSource = stringifyParams(
      {
        rootDirectoryUrl: webServer.rootDirectoryUrl,
        scriptInfos,
      },
      "        ",
    )
    injectScriptNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        textContent: `
      window.__supervisor__.setup({
        ${setupParamsSource}
      })
      `,
      }),
      "jsenv:supervisor",
    )
    injectScriptNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({ tagName: "script", src: supervisorScriptSrc }),
      "jsenv:supervisor",
    )
  }
  // 3. Perform actions (transforming inline script content) and html mutations
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()))
  }
  if (mutations.length === 0) {
    return null
  }
  mutations.forEach((mutation) => mutation())
  const htmlModified = stringifyHtmlAst(htmlAst)
  return {
    content: htmlModified,
  }
}

const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix)
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2)
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1)
}

const generateCodeToSuperviseScriptWithSrc = ({ type, src }) => {
  if (type === "js_module") {
    return `
        window.__supervisor__.superviseScriptTypeModule(${JSON.stringify(
          src,
        )}, (url) => import(url));
    `
  }
  return `
        window.__supervisor__.superviseScript(${JSON.stringify(src)});
    `
}
