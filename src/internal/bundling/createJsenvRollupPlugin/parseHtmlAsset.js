import { urlToBasename, urlToRelativeUrl, resolveUrl, urlToParentUrl } from "@jsenv/util"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  replaceHtmlNode,
  setHtmlNodeAttributeValue,
  stringifyHtmlAst,
  getHtmlNodeAttributeValue,
  getHtmlNodeTextContent,
  getHtmlNodeLocation,
  getUniqueNameForInlineHtmlNode,
} from "../../compiling/compileHtml.js"
import { minifyHtml } from "./minifyHtml.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"
import { getMutationsForSvgNodes } from "./parseSvgAsset.js"

export const parseHtmlAsset = async (
  { content, url },
  { notifyAssetFound, notifyInlineAssetFound, notifyJsFound, notifyInlineJsFound },
  {
    minify,
    minifyHtmlOptions,
    htmlStringToHtmlAst = (htmlString) => parseHtmlString(htmlString),
  } = {},
) => {
  const htmlString = String(content.value)
  const htmlAst = await htmlStringToHtmlAst(htmlString)
  const { links, styles, scripts, imgs, images, uses } = parseHtmlAstRessources(htmlAst)

  const htmlMutations = []
  scripts.forEach((script) => {
    const type = getHtmlNodeAttributeValue(script, "type") || "text/javascript"
    const src = getHtmlNodeAttributeValue(script, "src")
    const text = getHtmlNodeTextContent(script)

    // regular javascript are not parseable by rollup
    // and we don't really care about there content
    // we will handle them as regular asset
    // but we still want to inline/minify/hash them for performance
    if (type === "text/javascript" && src) {
      const remoteScriptReference = notifyAssetFound({
        specifier: src,
        contentType: "text/javascript",
        ...getHtmlNodeLocation(script),
      })
      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const { isInline } = remoteScriptReference.target
        if (isInline) {
          const { sourceAfterTransformation } = remoteScriptReference.target
          replaceHtmlNode(script, `<script>${sourceAfterTransformation}</script>`)
        } else {
          const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference)
          replaceHtmlNode(script, `<script src="${urlRelativeToImporter}"></script>`)
        }
      })
      return
    }
    if (type === "text/javascript" && text) {
      const inlineScriptReference = notifyInlineAssetFound({
        specifier: getUniqueNameForInlineHtmlNode(script, scripts, `${urlToBasename(url)}.[id].js`),
        ...getHtmlNodeLocation(script),
        content: {
          type: "text/javascript",
          value: text,
        },
      })
      htmlMutations.push(() => {
        const { sourceAfterTransformation } = inlineScriptReference.target
        replaceHtmlNode(script, `<script>${sourceAfterTransformation}</script>`)
      })
      return
    }

    if (type === "module" && src) {
      const remoteScriptReference = notifyJsFound({
        specifier: src,
        contentType: "text/javascript",
        ...getHtmlNodeLocation(script),
      })

      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference)
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
        content: {
          type: "text/javascript",
          value: text,
        },
      })
      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const urlRelativeToImporter = getReferenceUrlRelativeToImporter(inlineScriptReference)
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
        contentType: "application/importmap+json",
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
      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const { isInline } = remoteImportmapReference.target
        if (isInline) {
          // here put a warning if we cannot inline importmap because it would mess
          // the remapping (note that it's feasible) but not yet supported
          const { sourceAfterTransformation } = remoteImportmapReference.target
          replaceHtmlNode(
            script,
            `<script type="systemjs-importmap">${sourceAfterTransformation}</script>`,
          )
        } else {
          const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteImportmapReference)
          replaceHtmlNode(
            script,
            `<script type="systemjs-importmap" src="${urlRelativeToImporter}"></script>`,
          )
        }
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
        content: {
          type: "application/importmap+json",
          value: text,
        },
      })
      htmlMutations.push(() => {
        const { sourceAfterTransformation } = inlineImportMapReference.target
        replaceHtmlNode(
          script,
          `<script type="systemjs-importmap">${sourceAfterTransformation}</script>`,
        )
      })
      return
    }
  })
  links.forEach((link) => {
    const href = getHtmlNodeAttributeValue(link, "href")
    if (!href) {
      return
    }

    const type = getHtmlNodeAttributeValue(link, "type")
    let contentType
    if (type) {
      contentType = type
    } else {
      const rel = getHtmlNodeAttributeValue(link, "rel")
      if (rel === "stylesheet") {
        contentType = "text/css"
      } else {
        contentType = undefined
      }
    }
    const remoteLinkReference = notifyAssetFound({
      specifier: href,
      contentType,
      ...getHtmlNodeLocation(link),
    })
    htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
      const { isInline } = remoteLinkReference.target

      if (isInline) {
        if (getHtmlNodeAttributeValue(link, "rel") === "stylesheet") {
          const { sourceAfterTransformation } = remoteLinkReference.target
          replaceHtmlNode(link, `<style>${sourceAfterTransformation}</style>`)
        } else {
          replaceHtmlNode(
            link,
            `<link href="${getTargetAsBase64Url(remoteLinkReference.target)}" />`,
          )
        }
      } else {
        const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteLinkReference)
        replaceHtmlNode(link, `<link href="${urlRelativeToImporter}" />`)
      }
    })
  })
  styles.forEach((style) => {
    const text = getHtmlNodeTextContent(style)
    if (!text) {
      return
    }

    const inlineStyleReference = notifyInlineAssetFound({
      specifier: getUniqueNameForInlineHtmlNode(style, styles, `${urlToBasename(url)}.[id].css`),
      ...getHtmlNodeLocation(style),
      content: {
        type: "text/css",
        value: text,
      },
    })
    htmlMutations.push(() => {
      const { sourceAfterTransformation } = inlineStyleReference.target
      replaceHtmlNode(style, `<style>${sourceAfterTransformation}</style>`)
    })
  })
  imgs.forEach((img) => {
    const src = getHtmlNodeAttributeValue(img, "src")

    if (src) {
      const srcReference = notifyAssetFound({
        specifier: src,
        ...getHtmlNodeLocation(img),
      })
      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const srcNewValue = referenceToUrl(srcReference, getReferenceUrlRelativeToImporter)
        setHtmlNodeAttributeValue(img, "src", srcNewValue)
      })
    }

    const srcset = getHtmlNodeAttributeValue(img, "srcset")

    if (srcset) {
      const srcSetParts = []
      srcset.split(",").forEach((set) => {
        const [specifier, descriptor] = set.trim().split(" ")
        if (specifier) {
          srcSetParts.push({
            descriptor,
            reference: notifyAssetFound({
              specifier,
              ...getHtmlNodeLocation(img),
            }),
          })
        }
      })

      htmlMutations.push(({ getReferenceUrlRelativeToImporter }) => {
        const srcSetNewValue = srcSetParts
          .map(({ descriptor, reference }) => {
            const newSpecifier = referenceToUrl(reference, getReferenceUrlRelativeToImporter)
            return `${newSpecifier} ${descriptor}`
          })
          .join(", ")
        setHtmlNodeAttributeValue(img, "srcset", srcSetNewValue)
      })
    }
  })

  const svgNodeMutations = getMutationsForSvgNodes({ images, uses }, { notifyAssetFound })
  htmlMutations.push(...svgNodeMutations)

  return async ({ getReferenceUrlRelativeToImporter }) => {
    htmlMutations.forEach((mutationCallback) => {
      mutationCallback({ getReferenceUrlRelativeToImporter })
    })
    const htmlAfterTransformation = stringifyHtmlAst(htmlAst)
    const sourceAfterTransformation = minify
      ? minifyHtml(htmlAfterTransformation, minifyHtmlOptions)
      : htmlAfterTransformation
    return {
      sourceAfterTransformation,
    }
  }
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { isInline } = reference.target
  if (isInline) {
    return getTargetAsBase64Url(reference.target)
  }
  return getReferenceUrlRelativeToImporter(reference)
}

// otherwise systemjs thinks it's a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}
