import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeText,
  analyzeScriptNode,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  setHtmlNodeText,
  getHtmlNodePosition,
} from "@jsenv/ast"

export const jsenvPluginInliningIntoHtml = () => {
  return {
    name: "jsenv:inlining_into_html",
    appliesDuring: "*",
    finalizeUrlContent: {
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content)
        const mutations = []
        const actions = []

        const onStyleSheet = (linkNode, { href }) => {
          const linkReference = context.referenceUtils.find(
            (ref) =>
              ref.generatedSpecifier === href &&
              ref.type === "link_href" &&
              ref.subtype === "stylesheet",
          )
          if (
            !linkReference.original ||
            !linkReference.original.searchParams.has("inline")
          ) {
            return
          }
          const linkUrlInfo = context.urlGraph.getUrlInfo(linkReference.url)
          actions.push(async () => {
            await context.cook(linkUrlInfo, {
              reference: linkReference,
            })
            const { line, column, isOriginal } = getHtmlNodePosition(linkNode, {
              preferOriginal: true,
            })
            context.referenceUtils.becomesInline(linkReference, {
              line: line - 1,
              column,
              isOriginal,
              specifier: linkReference.generatedSpecifier,
              content: linkUrlInfo.content,
              contentType: linkUrlInfo.contentType,
            })
            mutations.push(() => {
              setHtmlNodeAttributes(linkNode, {
                "inlined-from-href": href,
                "href": undefined,
                "rel": undefined,
                "type": undefined,
                "as": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              })
              linkNode.nodeName = "style"
              linkNode.tagName = "style"
              setHtmlNodeText(linkNode, linkUrlInfo.content)
            })
          })
        }
        const onScriptWithSrc = (scriptNode, { type, src }) => {
          const urlObject = new URL(src, urlInfo.url)
          if (!urlObject.searchParams.has("inline")) {
            return
          }
          const scriptUrlInfo = context.urlGraph.getUrlInfo(urlObject.href)
          const [withoutParamReference, withoutParamUrlInfo] =
            context.getWithoutSearchParam({
              urlInfo: scriptUrlInfo,
              context,
              searchParam: "inline",
              expectedType: type,
            })
          actions.push(async () => {
            await context.cook(withoutParamUrlInfo, {
              reference: withoutParamReference,
            })
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
              })
              setHtmlNodeText(scriptNode, withoutParamUrlInfo.content)
            })
          })
        }

        visitHtmlNodes(htmlAst, {
          link: (linkNode) => {
            const rel = getHtmlNodeAttribute(linkNode, "rel")
            if (rel !== "stylesheet") {
              return
            }
            const href = getHtmlNodeAttribute(linkNode, "href")
            if (!href) {
              return
            }
            onStyleSheet(linkNode, { href })
          },
          script: (scriptNode) => {
            const { type } = analyzeScriptNode(scriptNode)
            const scriptNodeText = getHtmlNodeText(scriptNode)
            if (scriptNodeText) {
              return
            }
            const src = getHtmlNodeAttribute(scriptNode, "src")
            if (!src) {
              return
            }
            onScriptWithSrc(scriptNode, { type, src })
          },
        })
        if (actions.length > 0) {
          await Promise.all(actions.map((action) => action()))
        }
        mutations.forEach((mutation) => mutation())
        const htmlModified = stringifyHtmlAst(htmlAst)
        return htmlModified
      },
    },
  }
}
