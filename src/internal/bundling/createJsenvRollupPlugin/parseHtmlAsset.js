import { urlToBasename, urlToRelativeUrl, resolveUrl, urlToParentUrl } from "@jsenv/util"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  replaceHtmlNode,
  stringifyHtmlAst,
  getHtmlNodeAttributeValue,
  getHtmlNodeTextContent,
  getHtmlNodeLocation,
  getUniqueNameForInlineHtmlNode,
} from "../../compiling/compileHtml.js"

export const parseHtmlAsset = async (
  { source, url },
  { notifyAssetFound, notifyInlineAssetFound, notifyJsFound, notifyInlineJsFound },
  { htmlStringToHtmlAst = (htmlString) => parseHtmlString(htmlString) } = {},
) => {
  const htmlString = String(source)
  const htmlAst = await htmlStringToHtmlAst(htmlString)
  const { scripts, stylesheetLinks, styles } = parseHtmlAstRessources(htmlAst)

  const htmlMutationMap = new Map()
  scripts.forEach((script) => {
    const type = getHtmlNodeAttributeValue(script, "type") || "text/javascript"
    const src = getHtmlNodeAttributeValue(script, "src")
    const text = getHtmlNodeTextContent(script)

    // regular javascript are not parseable by rollup
    // and we don't really care about there content
    // we will handle them as regular asset
    // but we can still inline/minify/hash them for performance
    if (type === "text/javascript" && src) {
      const remoteScriptReference = notifyAssetFound({
        specifier: src,
        ...getHtmlNodeLocation(script),
      })
      htmlMutationMap.set(remoteScriptReference, ({ urlRelativeToImporter }) => {
        replaceHtmlNode(script, `<script src="${urlRelativeToImporter}"></script>`)
      })
      return
    }
    if (type === "text/javascript" && text) {
      const inlineScriptReference = notifyInlineAssetFound({
        specifier: getUniqueNameForInlineHtmlNode(script, scripts, `${urlToBasename(url)}.[id].js`),
        ...getHtmlNodeLocation(script),
        source: text,
      })
      htmlMutationMap.set(inlineScriptReference, ({ sourceAfterTransformation }) => {
        replaceHtmlNode(script, `<script>${sourceAfterTransformation}</script>`)
      })
      return
    }

    if (type === "module" && src) {
      const remoteScriptReference = notifyJsFound({
        specifier: src,
        ...getHtmlNodeLocation(script),
      })

      htmlMutationMap.set(remoteScriptReference, ({ urlRelativeToImporter }) => {
        replaceHtmlNode(
          script,
          `<script>window.System.import(${JSON.stringify(
            ensureRelativeUrlNotation(urlRelativeToImporter),
          )})</script>`,
        )
      })
      return
    }
    if (type === "module" && text) {
      const inlineScriptReference = notifyInlineJsFound({
        specifier: getUniqueNameForInlineHtmlNode(script, scripts, `${urlToBasename(url)}.[id].js`),
        ...getHtmlNodeLocation(script),
        source: text,
      })
      htmlMutationMap.set(inlineScriptReference, ({ urlRelativeToImporter }) => {
        replaceHtmlNode(
          script,
          `<script>window.System.import(${JSON.stringify(
            ensureRelativeUrlNotation(urlRelativeToImporter),
          )})</script>`,
        )
      })
      return
    }

    if (type === "importmap" && src) {
      const remoteImportmapReference = notifyAssetFound({
        specifier: src,
        ...getHtmlNodeLocation(script),
        // here we want to force the fileName for the importmap
        // so that we don't have to rewrite its content
        // the goal is to put the importmap at the same relative path
        // than in the project
        fileNamePattern: () => {
          const importmapUrl = remoteImportmapReference.url
          const importmapRelativeUrl = urlToRelativeUrl(
            remoteImportmapReference.target.url,
            importmapUrl,
          )
          const importmapParentRelativeUrl = urlToRelativeUrl(
            urlToParentUrl(resolveUrl(importmapRelativeUrl, "file://")),
            "file://",
          )
          return `${importmapParentRelativeUrl}[name]-[hash][extname]`
        },
      })
      htmlMutationMap.set(remoteImportmapReference, ({ urlRelativeToImporter }) => {
        replaceHtmlNode(
          script.node,
          `<script type="systemjs-importmap" src="${urlRelativeToImporter}"></script>`,
        )
      })
      return
    }
    if (type === "importmap" && text) {
      const inlineImportMapReference = notifyInlineAssetFound({
        specifier: getUniqueNameForInlineHtmlNode(
          script,
          scripts,
          `${urlToBasename(url)}.[id].importmap`,
        ),
        ...getHtmlNodeLocation(script),
        source: text,
      })
      htmlMutationMap.set(inlineImportMapReference, ({ sourceAfterTransformation }) => {
        replaceHtmlNode(
          script,
          `<script type="systemjs-importmap">${sourceAfterTransformation}</script>`,
        )
      })
      return
    }
  })
  stylesheetLinks.forEach((stylesheetLink) => {
    const href = getHtmlNodeAttributeValue(stylesheetLink, "href")
    if (href) {
      const remoteStyleReference = notifyAssetFound({
        specifier: href,
        ...getHtmlNodeLocation(stylesheetLink),
      })
      htmlMutationMap.set(remoteStyleReference, ({ urlRelativeToImporter }) => {
        replaceHtmlNode(stylesheetLink, `<link href="${urlRelativeToImporter}"/>`)
      })
    }
  })
  styles.forEach((style) => {
    const text = getHtmlNodeTextContent(style)
    if (text) {
      const inlineStyleReference = notifyInlineAssetFound({
        specifier: getUniqueNameForInlineHtmlNode(style, styles, `${urlToBasename(url)}.[id].css`),
        ...getHtmlNodeLocation(style),
        source: text,
      })
      htmlMutationMap.set(inlineStyleReference, ({ sourceAfterTransformation }) => {
        replaceHtmlNode(style, `<style>${sourceAfterTransformation}</style>`)
      })
    }
  })

  return async (dependenciesMapping) => {
    htmlMutationMap.forEach((mutationCallback, reference) => {
      const urlRelativeToImporter = dependenciesMapping[reference.target.url]
      mutationCallback({
        urlRelativeToImporter,
        sourceAfterTransformation: reference.target.sourceAfterTransformation,
      })
    })
    const htmlAfterTransformation = stringifyHtmlAst(htmlAst)
    // const sourceAfterTransformation = minify ? minifyHtml(htmlTransformedString, minifyHtmlOptions) : htmlAfterTransformation
    return {
      sourceAfterTransformation: htmlAfterTransformation,
    }
  }
}

// otherwise systemjs thinks it's a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}
