/*
 * Jsenv needs to track js execution in order to:
 * 1. report errors
 * 2. wait for all js execution inside an HTML page before killing the browser
 *
 * A naive approach would rely on "load" events on window but:
 * scenario                                    | covered by window "load"
 * ------------------------------------------- | -------------------------
 * js referenced by <script src>               | yes
 * js inlined into <script>                    | yes
 * js referenced by <script type="module" src> | partially (not for import and top level await)
 * js inlined into <script type="module">      | not at all
 * Same for "error" event on window who is not enough
 *
 * <script src="file.js">
 * becomes
 * <script>
 *   window.__supervisor__.superviseScript('file.js')
 * </script>
 *
 * <script>
 *    console.log(42)
 * </script>
 * becomes
 * <script>
 *   window.__supervisor__.jsClassicStart('main.html@L10-L13.js')
 *   try {
 *     console.log(42)
 *     window.__supervisor__.jsClassicEnd('main.html@L10-L13.js')
 *   } catch(e) {
 *     window.__supervisor__.jsClassicError('main.html@L10-L13.js', e)
 *   }
 * </script>
 *
 * <script type="module" src="module.js"></script>
 * becomes
 * <script type="module">
 *   window.__supervisor__.superviseScriptTypeModule('module.js')
 * </script>
 *
 * <script type="module">
 *   console.log(42)
 * </script>
 * becomes
 * <script type="module">
 *   window.__supervisor__.jsModuleStart('main.html@L10-L13.js')
 *   try {
 *     console.log(42)
 *     window.__supervisor__.jsModuleEnd('main.html@L10-L13.js')
 *   } catch(e) {
 *     window.__supervisor__.jsModuleError('main.html@L10-L13.js', e)
 *   }
 * </script>
 */

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
import { generateInlineContentUrl, urlToRelativeUrl } from "@jsenv/urls"

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
        type,
        textContent,
        inlineScriptUrl,
        isOriginal,
        line,
        column,
      })
      scriptInfos.push({ type, src: inlineScriptSrc, isInline: true })
      actions.push(async () => {
        const inlineJsSupervised = await injectSupervisorIntoJs({
          content: textContent,
          url: inlineScriptUrl,
          type,
          inlineSrc: inlineScriptSrc,
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
      scriptInfos.push({ type, src })
      const remoteJsSupervised = generateCodeToSuperviseScriptWithSrc({
        type,
        src,
      })
      mutations.push(() => {
        setHtmlNodeText(scriptNode, remoteJsSupervised)
        setHtmlNodeAttributes(scriptNode, {
          "jsenv-cooked-by": "jsenv:supervisor",
          "src": undefined,
          "inlined-from-src": src,
        })
      })
    }
    visitHtmlNodes(htmlAst, {
      script: (scriptNode) => {
        const { type, extension } = analyzeScriptNode(scriptNode)
        if (type !== "js_classic" && type !== "js_module") {
          return
        }
        if (getHtmlNodeAttribute(scriptNode, "jsenv-injected-by")) {
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
