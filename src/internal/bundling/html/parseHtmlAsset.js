/**

Finds all asset reference in html then update all references to target the files in dist/ when needed.

There is some cases where the asset won't be found and updated:
- inline styles
- inline attributes

Don't write the following for instance:

<div style="background:url('img.png')"></div>

Or be sure to also reference this url somewhere in the html file like

<link rel="preload" href="img.png" />

*/

import { urlToBasename, urlToRelativeUrl, resolveUrl, urlToParentUrl } from "@jsenv/util"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  replaceHtmlNode,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  getHtmlNodeLocation,
  getUniqueNameForInlineHtmlNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  getHtmlNodeTextNode,
  parseSrcset,
  stringifySrcset,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { minifyHtml } from "./minifyHtml.js"
import { getTargetAsBase64Url } from "../getTargetAsBase64Url.js"
import { collectNodesMutations } from "../parsing.utils.js"
import { collectSvgMutations } from "./parseSvgAsset.js"

export const parseHtmlAsset = async (
  target,
  notifiers,
  {
    minify,
    minifyHtmlOptions,
    transformImportmapTarget = () => {},
    htmlStringToHtmlAst = (htmlString) => parseHtmlString(htmlString),
    htmlAstToHtmlString = (htmlAst) => stringifyHtmlAst(htmlAst),
  } = {},
) => {
  const htmlString = String(target.content.value)
  const htmlAst = await htmlStringToHtmlAst(htmlString)
  const { links, styles, scripts, imgs, images, uses, sources } = parseHtmlAstRessources(htmlAst)

  const scriptsMutations = collectNodesMutations(scripts, notifiers, target, [
    // regular javascript are not parseable by rollup
    // and we don't really care about there content
    // we will handle them as regular asset
    // but we still want to inline/minify/hash them for performance
    regularScriptSrcVisitor,
    regularScriptTextNodeVisitor,
    moduleScriptSrcVisitor,
    moduleScriptTextNodeVisitor,
    importmapScriptSrcVisitor,
    importmapScriptTextNodeVisitor,
  ])
  const linksMutations = collectNodesMutations(links, notifiers, target, [
    linkStylesheetHrefVisitor,
    linkHrefVisitor,
  ])
  const stylesMutations = collectNodesMutations(styles, notifiers, target, [styleTextNodeVisitor])
  const imgsSrcMutations = collectNodesMutations(imgs, notifiers, target, [imgSrcVisitor])
  const imgsSrcsetMutations = collectNodesMutations(imgs, notifiers, target, [srcsetVisitor])
  const sourcesSrcMutations = collectNodesMutations(sources, notifiers, target, [sourceSrcVisitor])
  const sourcesSrcsetMutations = collectNodesMutations(sources, notifiers, target, [srcsetVisitor])
  const svgMutations = collectSvgMutations({ images, uses }, notifiers, target)

  const htmlMutations = [
    ...scriptsMutations,
    ...linksMutations,
    ...stylesMutations,
    ...imgsSrcMutations,
    ...imgsSrcsetMutations,
    ...sourcesSrcMutations,
    ...sourcesSrcsetMutations,
    ...svgMutations,
  ]

  return async (params) => {
    htmlMutations.forEach((mutationCallback) => {
      mutationCallback({
        ...params,
        transformImportmapTarget,
      })
    })

    const htmlAfterTransformation = htmlAstToHtmlString(htmlAst)
    const sourceAfterTransformation = minify
      ? minifyHtml(htmlAfterTransformation, minifyHtmlOptions)
      : htmlAfterTransformation
    return {
      sourceAfterTransformation,
    }
  }
}

const regularScriptSrcVisitor = (script, { notifyReferenceFound }) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" || typeAttribute.value !== "application/javascript")
  ) {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (!srcAttribute) {
    return null
  }

  const remoteScriptReference = notifyReferenceFound({
    contentType: "text/javascript",
    specifier: srcAttribute.value,
    ...getHtmlNodeLocation(script),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const { isInline } = remoteScriptReference.target
    if (isInline) {
      removeHtmlNodeAttribute(script, srcAttribute)
      const { sourceAfterTransformation } = remoteScriptReference.target
      setHtmlNodeText(script, sourceAfterTransformation)
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference)
      srcAttribute.value = urlRelativeToImporter
    }
  }
}

const regularScriptTextNodeVisitor = (script, { notifyReferenceFound }, target, scripts) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" || typeAttribute.value !== "application/javascript")
  ) {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(script)
  if (!textNode) {
    return null
  }

  const jsReference = notifyReferenceFound({
    contentType: "text/javascript",
    specifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(target.url)}.[id].js`,
    ),
    ...getHtmlNodeLocation(script),
    content: {
      type: "text/javascript",
      value: textNode.value,
    },
  })
  return () => {
    const { sourceAfterTransformation } = jsReference.target
    textNode.value = sourceAfterTransformation
  }
}

const moduleScriptSrcVisitor = (script, { notifyReferenceFound }) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "module") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (!srcAttribute) {
    return null
  }

  const remoteScriptReference = notifyReferenceFound({
    isJsModule: true,
    contentType: "text/javascript",
    specifier: srcAttribute.value,
    ...getHtmlNodeLocation(script),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    removeHtmlNodeAttribute(script, typeAttribute)
    removeHtmlNodeAttribute(script, srcAttribute)
    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference)
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter)
    setHtmlNodeText(script, `window.System.import(${JSON.stringify(relativeUrlNotation)})`)
  }
}

const moduleScriptTextNodeVisitor = (script, { notifyReferenceFound }, target, scripts) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "module") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(script)
  if (!textNode) {
    return null
  }

  const jsReference = notifyReferenceFound({
    isJsModule: true,
    contentType: "text/javascript",
    specifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(target.url)}.[id].js`,
    ),
    ...getHtmlNodeLocation(script),
    content: {
      type: "text/javascript",
      value: textNode.value,
    },
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    removeHtmlNodeAttribute(script, typeAttribute)
    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(jsReference)
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter)
    textNode.value = `window.System.import(${JSON.stringify(relativeUrlNotation)})`
  }
}

const importmapScriptSrcVisitor = (script, { format, notifyReferenceFound }) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "importmap") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (!srcAttribute) {
    return null
  }

  const importmapReference = notifyReferenceFound({
    contentType: "application/importmap+json",
    specifier: srcAttribute.value,
    ...getHtmlNodeLocation(script),
    // here we want to force the fileName for the importmap
    // so that we don't have to rewrite its content
    // the goal is to put the importmap at the same relative path
    // than in the project
    fileNamePattern: () => {
      const importmapUrl = importmapReference.url
      const importmapRelativeUrl = urlToRelativeUrl(importmapReference.target.url, importmapUrl)
      const importmapParentRelativeUrl = urlToRelativeUrl(
        urlToParentUrl(resolveUrl(importmapRelativeUrl, "file://")),
        "file://",
      )
      return `${importmapParentRelativeUrl}[name]-[hash][extname]`
    },
  })
  return ({ getReferenceUrlRelativeToImporter, transformImportmapTarget }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }
    transformImportmapTarget(importmapReference.target)

    const { isInline } = importmapReference.target
    if (isInline) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      removeHtmlNodeAttribute(script, srcAttribute)
      const { sourceAfterTransformation } = importmapReference.target
      setHtmlNodeText(script, sourceAfterTransformation)
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(importmapReference)
      srcAttribute.value = urlRelativeToImporter
    }
  }
}

const importmapScriptTextNodeVisitor = (
  script,
  { format, notifyReferenceFound },
  target,
  scripts,
) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "importmap") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(script)
  if (!textNode) {
    return null
  }

  const importmapReference = notifyReferenceFound({
    contentType: "application/importmap+json",
    specifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(target.url)}.[id].importmap`,
    ),
    ...getHtmlNodeLocation(script),
    content: {
      type: "application/importmap+json",
      value: textNode.value,
    },
  })
  return ({ transformImportmapTarget }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }
    transformImportmapTarget(importmapReference.target)

    const { sourceAfterTransformation } = importmapReference.target
    textNode.value = sourceAfterTransformation
  }
}

const linkStylesheetHrefVisitor = (link, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  if (!hrefAttribute) {
    return null
  }
  const relAttribute = getHtmlNodeAttributeByName(link, "rel")
  if (!relAttribute) {
    return null
  }
  if (relAttribute.value !== "stylesheet") {
    return null
  }

  const cssReference = notifyReferenceFound({
    contentType: "text/css",
    specifier: hrefAttribute.value,
    ...getHtmlNodeLocation(link),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const { isInline } = cssReference.target

    if (isInline) {
      const { sourceAfterTransformation } = cssReference.target
      replaceHtmlNode(link, `<style>${sourceAfterTransformation}</style>`)
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(cssReference)
      hrefAttribute.value = urlRelativeToImporter
    }
  }
}

const linkHrefVisitor = (link, { notifyReferenceFound }) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  if (!hrefAttribute) {
    return null
  }

  const typeAttribute = getHtmlNodeAttributeByName(link, "type")
  const reference = notifyReferenceFound({
    contentType: typeAttribute ? typeAttribute.value : undefined,
    specifier: hrefAttribute.value,
    ...getHtmlNodeLocation(link),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const { isInline } = reference.target

    if (isInline) {
      replaceHtmlNode(link, `<link href="${getTargetAsBase64Url(reference.target)}" />`)
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(reference)
      hrefAttribute.value = urlRelativeToImporter
    }
  }
}

const styleTextNodeVisitor = (style, { notifyReferenceFound }, target, styles) => {
  const textNode = getHtmlNodeTextNode(style)
  if (!textNode) {
    return null
  }

  const inlineStyleReference = notifyReferenceFound({
    contentType: "text/css",
    specifier: getUniqueNameForInlineHtmlNode(
      style,
      styles,
      `${urlToBasename(target.url)}.[id].css`,
    ),
    ...getHtmlNodeLocation(style),
    content: {
      type: "text/css",
      value: textNode.value,
    },
  })
  return () => {
    const { sourceAfterTransformation } = inlineStyleReference.target
    textNode.value = sourceAfterTransformation
  }
}

const imgSrcVisitor = (img, { notifyReferenceFound }) => {
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  if (!srcAttribute) {
    return null
  }

  const srcReference = notifyReferenceFound({
    specifier: srcAttribute.value,
    ...getHtmlNodeLocation(img),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl(srcReference, getReferenceUrlRelativeToImporter)
    srcAttribute.value = srcNewValue
  }
}

const srcsetVisitor = (htmlNode, { notifyReferenceFound }) => {
  const srcsetAttribute = getHtmlNodeAttributeByName(htmlNode, "srcset")
  if (!srcsetAttribute) {
    return null
  }

  const srcsetParts = parseSrcset(srcsetAttribute.value)
  const srcsetPartsReferences = srcsetParts.map(({ specifier }) =>
    notifyReferenceFound({
      specifier,
      ...getHtmlNodeLocation(htmlNode),
    }),
  )
  if (srcsetParts.length === 0) {
    return null
  }

  return ({ getReferenceUrlRelativeToImporter }) => {
    srcsetParts.forEach((srcsetPart, index) => {
      const reference = srcsetPartsReferences[index]
      srcsetPart.specifier = referenceToUrl(reference, getReferenceUrlRelativeToImporter)
    })

    const srcsetNewValue = stringifySrcset(srcsetParts)
    srcsetAttribute.value = srcsetNewValue
  }
}

const sourceSrcVisitor = (source, { notifyReferenceFound }) => {
  const srcAttribute = getHtmlNodeAttributeByName(source, "src")
  if (!srcAttribute) {
    return null
  }

  const typeAttribute = getHtmlNodeAttributeByName(source, "type")
  const srcReference = notifyReferenceFound({
    contentType: typeAttribute ? typeAttribute.value : undefined,
    specifier: srcAttribute.value,
    ...getHtmlNodeLocation(source),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl(srcReference, getReferenceUrlRelativeToImporter)
    srcAttribute.value = srcNewValue
  }
}

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const { isInline } = reference.target
  if (isInline) {
    return getTargetAsBase64Url(reference.target)
  }
  return getReferenceUrlRelativeToImporter(reference)
}

// otherwise systemjs handle it as a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}
