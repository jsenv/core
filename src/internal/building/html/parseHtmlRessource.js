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

import {
  urlToBasename,
  urlToRelativeUrl,
  resolveUrl,
  urlToParentUrl,
} from "@jsenv/filesystem"

import {
  parseHtmlString,
  parseHtmlAstRessources,
  replaceHtmlNode,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  getUniqueNameForInlineHtmlNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  getHtmlNodeTextNode,
  parseSrcset,
  stringifySrcset,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import {
  getRessourceAsBase64Url,
  isReferencedOnlyByRessourceHint,
} from "../ressource_builder_util.js"
import {
  collectNodesMutations,
  htmlNodeToReferenceLocation,
} from "../parsing.utils.js"
import { collectSvgMutations } from "../svg/parseSvgRessource.js"
import { minifyHtml } from "./minifyHtml.js"

export const parseHtmlRessource = async (
  htmlRessource,
  notifiers,
  {
    minify,
    minifyHtmlOptions,
    htmlStringToHtmlAst = (htmlString) => parseHtmlString(htmlString),
    htmlAstToHtmlString = (htmlAst) => stringifyHtmlAst(htmlAst),
    ressourceHintNeverUsedCallback = () => {},
  } = {},
) => {
  const htmlString = String(htmlRessource.bufferBeforeBuild)
  const htmlAst = await htmlStringToHtmlAst(htmlString)
  const { links, styles, scripts, imgs, images, uses, sources } =
    parseHtmlAstRessources(htmlAst)

  const linksMutations = collectNodesMutations(
    links,
    notifiers,
    htmlRessource,
    [
      linkStylesheetHrefVisitor,
      (link, notifiers) =>
        linkHrefVisitor(link, {
          ...notifiers,
          ressourceHintNeverUsedCallback,
        }),
    ],
  )
  const scriptsMutations = collectNodesMutations(
    scripts,
    notifiers,
    htmlRessource,
    [
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
    ],
  )
  const stylesMutations = collectNodesMutations(
    styles,
    notifiers,
    htmlRessource,
    [styleTextNodeVisitor],
  )
  const imgsSrcMutations = collectNodesMutations(
    imgs,
    notifiers,
    htmlRessource,
    [imgSrcVisitor],
  )
  const imgsSrcsetMutations = collectNodesMutations(
    imgs,
    notifiers,
    htmlRessource,
    [srcsetVisitor],
  )
  const sourcesSrcMutations = collectNodesMutations(
    sources,
    notifiers,
    htmlRessource,
    [sourceSrcVisitor],
  )
  const sourcesSrcsetMutations = collectNodesMutations(
    sources,
    notifiers,
    htmlRessource,
    [srcsetVisitor],
  )
  const svgMutations = collectSvgMutations(
    { images, uses },
    notifiers,
    htmlRessource,
  )

  const htmlMutations = [
    ...linksMutations,
    ...scriptsMutations,
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
      })
    })

    const htmlAfterTransformation = htmlAstToHtmlString(htmlAst)
    return minify
      ? minifyHtml(htmlAfterTransformation, minifyHtmlOptions)
      : htmlAfterTransformation
  }
}

const regularScriptSrcVisitor = (
  script,
  { notifyReferenceFound },
  htmlRessource,
) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" ||
      typeAttribute.value !== "application/javascript")
  ) {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  if (!srcAttribute) {
    return null
  }

  const remoteScriptReference = notifyReferenceFound({
    ressourceContentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    if (remoteScriptReference.ressource.isExternal) {
      return
    }

    if (shouldInline({ reference: remoteScriptReference, htmlNode: script })) {
      removeHtmlNodeAttribute(script, srcAttribute)
      const { ressource } = remoteScriptReference
      const { bufferAfterBuild } = ressource
      let jsString = String(bufferAfterBuild)

      const sourcemapRelativeUrl = getJavaScriptSourceMappingUrl(jsString)
      if (sourcemapRelativeUrl) {
        const { ressourceBuildRelativeUrl } = ressource
        const jsBuildUrl = resolveUrl(ressourceBuildRelativeUrl, "file:///")
        const sourcemapBuildUrl = resolveUrl(sourcemapRelativeUrl, jsBuildUrl)
        const htmlUrl = resolveUrl(htmlRessource.fileNamePattern, "file:///")
        const sourcemapInlineUrl = urlToRelativeUrl(sourcemapBuildUrl, htmlUrl)
        jsString = setJavaScriptSourceMappingUrl(jsString, sourcemapInlineUrl)
      }

      setHtmlNodeText(script, jsString)
      return
    }

    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(
      remoteScriptReference,
    )
    srcAttribute.value = urlRelativeToImporter
  }
}

const regularScriptTextNodeVisitor = (
  script,
  { notifyReferenceFound },
  htmlRessource,
  scripts,
) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" ||
      typeAttribute.value !== "application/javascript")
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
    ressourceContentTypeExpected: "application/javascript",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(htmlRessource.url)}.[id].js`,
    ),
    ...htmlNodeToReferenceLocation(script),

    contentType: "application/javascript",
    bufferBeforeBuild: Buffer.from(textNode.value),
    isInline: true,
  })
  return () => {
    const { bufferAfterBuild } = jsReference.ressource
    textNode.value = bufferAfterBuild
  }
}

const moduleScriptSrcVisitor = (script, { format, notifyReferenceFound }) => {
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
    ressourceContentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script),

    isJsModule: true,
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-module"
    }

    if (remoteScriptReference.ressource.isExternal) {
      return
    }

    if (shouldInline({ reference: remoteScriptReference, htmlNode: script })) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      removeHtmlNodeAttribute(script, srcAttribute)
      const { ressource } = remoteScriptReference
      const { bufferAfterBuild } = ressource
      let jsString = String(bufferAfterBuild)

      // at this stage, for some reason the sourcemap url is not in the js
      // (it will be added sshortly after by "injectSourcemapInRollupBuild")
      // but we know that a script type module have a sourcemap
      // and will be next to html file
      // with these assumptions we can force the sourcemap url
      const sourcemapUrl = `${ressource.ressourceBuildRelativeUrl}.map`
      jsString = setJavaScriptSourceMappingUrl(jsString, sourcemapUrl)

      setHtmlNodeText(script, jsString)
      return
    }

    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(
      remoteScriptReference,
    )
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter)
    srcAttribute.value = relativeUrlNotation
  }
}

const moduleScriptTextNodeVisitor = (
  script,
  { format, notifyReferenceFound },
  htmlRessource,
  scripts,
) => {
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
    ressourceContentTypeExpected: "application/javascript",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(htmlRessource.url)}.[id].js`,
    ),
    ...htmlNodeToReferenceLocation(script),

    contentType: "application/javascript",
    bufferBeforeBuild: textNode.value,
    isJsModule: true,
    isInline: true,
  })
  return () => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-module"
    }
    const { bufferAfterBuild } = jsReference.ressource
    textNode.value = bufferAfterBuild
  }
}

const importmapScriptSrcVisitor = (
  script,
  { format, notifyReferenceFound },
) => {
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
    ressourceContentTypeExpected: "application/importmap+json",
    ressourceSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script),

    // here we want to force the fileName for the importmap
    // so that we don't have to rewrite its content
    // the goal is to put the importmap at the same relative path
    // than in the project
    fileNamePattern: () => {
      const importmapReferenceUrl = importmapReference.referenceUrl
      const importmapRessourceUrl = importmapReference.ressource.url
      const importmapUrlRelativeToImporter = urlToRelativeUrl(
        importmapRessourceUrl,
        importmapReferenceUrl,
      )
      const importmapParentRelativeUrl = urlToRelativeUrl(
        urlToParentUrl(resolveUrl(importmapUrlRelativeToImporter, "file://")),
        "file://",
      )
      return `${importmapParentRelativeUrl}[name]-[hash][extname]`
    },
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }

    if (importmapReference.ressource.isExternal) {
      return
    }

    if (shouldInline({ reference: importmapReference, htmlNode: script })) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      removeHtmlNodeAttribute(script, srcAttribute)
      const { bufferAfterBuild } = importmapReference.ressource

      const jsString = String(bufferAfterBuild)

      setHtmlNodeText(script, jsString)
      return
    }

    const urlRelativeToImporter =
      getReferenceUrlRelativeToImporter(importmapReference)
    srcAttribute.value = urlRelativeToImporter
  }
}

const importmapScriptTextNodeVisitor = (
  script,
  { format, notifyReferenceFound },
  htmlRessource,
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
    ressourceContentTypeExpected: "application/importmap+json",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToBasename(htmlRessource.url)}.[id].importmap`,
    ),
    ...htmlNodeToReferenceLocation(script),

    contentType: "application/importmap+json",
    bufferBeforeBuild: Buffer.from(textNode.value),
    isInline: true,
  })
  return () => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }

    const { bufferAfterBuild } = importmapReference.ressource
    textNode.value = bufferAfterBuild
  }
}

const linkStylesheetHrefVisitor = (
  link,
  { notifyReferenceFound },
  htmlRessource,
) => {
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
    ressourceContentTypeExpected: "text/css",
    ressourceSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(link),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    if (cssReference.ressource.isExternal) {
      return
    }

    if (shouldInline({ reference: cssReference, htmlNode: link })) {
      const { ressource } = cssReference
      const { bufferAfterBuild } = ressource
      let cssString = String(bufferAfterBuild)
      const sourcemapRelativeUrl = getCssSourceMappingUrl(cssString)
      if (sourcemapRelativeUrl) {
        const { ressourceBuildRelativeUrl } = ressource
        const cssBuildUrl = resolveUrl(ressourceBuildRelativeUrl, "file:///")
        const sourcemapBuildUrl = resolveUrl(sourcemapRelativeUrl, cssBuildUrl)
        const htmlUrl = resolveUrl(htmlRessource.fileNamePattern, "file:///")
        const sourcemapInlineUrl = urlToRelativeUrl(sourcemapBuildUrl, htmlUrl)
        cssString = setCssSourceMappingUrl(cssString, sourcemapInlineUrl)
      }

      replaceHtmlNode(link, `<style>${cssString}</style>`, {
        attributesToIgnore: ["href", "rel", "as", "crossorigin", "type"],
      })
      return
    }

    const urlRelativeToImporter =
      getReferenceUrlRelativeToImporter(cssReference)
    hrefAttribute.value = urlRelativeToImporter
  }
}

const linkHrefVisitor = (
  link,
  { format, notifyReferenceFound, ressourceHintNeverUsedCallback },
) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
  if (!hrefAttribute) {
    return null
  }

  const relAttribute = getHtmlNodeAttributeByName(link, "rel")
  const rel = relAttribute ? relAttribute.value : undefined
  const isRessourceHint = [
    "preconnect",
    "dns-prefetch",
    "prefetch",
    "preload",
    "modulepreload",
  ].includes(rel)

  let ressourceContentTypeExpected
  const typeAttribute = getHtmlNodeAttributeByName(link, "type")
  const type = typeAttribute ? typeAttribute.value : ""
  let isJsModule = false
  if (type) {
    ressourceContentTypeExpected = type
  } else if (rel === "manifest") {
    ressourceContentTypeExpected = "application/manifest+json"
  } else if (rel === "modulepreload") {
    ressourceContentTypeExpected = "application/javascript"
    isJsModule = true
  }

  const linkReference = notifyReferenceFound({
    isRessourceHint,
    ressourceContentTypeExpected,
    ressourceSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(link),
    urlVersioningDisabled:
      ressourceContentTypeExpected === "application/manifest+json",
    isJsModule,
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const linkRessource = linkReference.ressource
    if (isRessourceHint) {
      if (isReferencedOnlyByRessourceHint(linkRessource)) {
        ressourceHintNeverUsedCallback({
          htmlNode: link,
          rel,
          href: hrefAttribute.value,
        })
        // we could remove the HTML node but better keep it untouched and let user decide what to do
        return
      }
    }

    if (linkRessource.isExternal) {
      return
    }

    if (format === "systemjs" && rel === "modulepreload") {
      const urlRelativeToImporter =
        getReferenceUrlRelativeToImporter(linkReference)
      replaceHtmlNode(
        link,
        `<link rel="preload" href="${urlRelativeToImporter}" as="script" />`,
      )
      return
    }

    if (shouldInline({ reference: linkReference, htmlNode: link })) {
      replaceHtmlNode(
        link,
        `<link href="${getRessourceAsBase64Url(linkReference.ressource)}" />`,
      )
      return
    }

    const urlRelativeToImporter =
      getReferenceUrlRelativeToImporter(linkReference)
    hrefAttribute.value = urlRelativeToImporter
  }
}

const styleTextNodeVisitor = (
  style,
  { notifyReferenceFound },
  htmlRessource,
  styles,
) => {
  const textNode = getHtmlNodeTextNode(style)
  if (!textNode) {
    return null
  }

  const inlineStyleReference = notifyReferenceFound({
    ressourceContentTypeExpected: "text/css",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      style,
      styles,
      `${urlToBasename(htmlRessource.url)}.[id].css`,
    ),
    ...htmlNodeToReferenceLocation(style),

    contentType: "text/css",
    bufferBeforeBuild: Buffer.from(textNode.value),
    isInline: true,
  })
  return () => {
    const { bufferAfterBuild } = inlineStyleReference.ressource
    textNode.value = bufferAfterBuild
  }
}

const imgSrcVisitor = (img, { notifyReferenceFound }) => {
  const srcAttribute = getHtmlNodeAttributeByName(img, "src")
  if (!srcAttribute) {
    return null
  }

  const srcReference = notifyReferenceFound({
    ressourceSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(img),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: img,
      getReferenceUrlRelativeToImporter,
    })
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
      ressourceSpecifier: specifier,
      ...htmlNodeToReferenceLocation(htmlNode),
    }),
  )
  if (srcsetParts.length === 0) {
    return null
  }

  return ({ getReferenceUrlRelativeToImporter }) => {
    srcsetParts.forEach((srcsetPart, index) => {
      const reference = srcsetPartsReferences[index]
      srcsetPart.specifier = referenceToUrl({
        reference,
        htmlNode,
        getReferenceUrlRelativeToImporter,
      })
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
    ressourceContentTypeExpected: typeAttribute
      ? typeAttribute.value
      : undefined,
    ressourceSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(source),
  })
  return ({ getReferenceUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: source,
      getReferenceUrlRelativeToImporter,
    })
    srcAttribute.value = srcNewValue
  }
}

const referenceToUrl = ({
  reference,
  htmlNode,
  getReferenceUrlRelativeToImporter,
}) => {
  const referenceRessource = reference.ressource
  if (referenceRessource.isExternal) {
    return referenceRessource.url
  }
  if (shouldInline({ reference, htmlNode })) {
    return getRessourceAsBase64Url(referenceRessource)
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

const shouldInline = ({ reference, htmlNode }) => {
  if (reference.ressource.isInline) {
    return true
  }

  return readAndRemoveForceInline(htmlNode)
}

const readAndRemoveForceInline = (htmlNode) => {
  const jsenvForceInlineAttribute = getHtmlNodeAttributeByName(
    htmlNode,
    "data-jsenv-force-inline",
  )
  if (jsenvForceInlineAttribute) {
    removeHtmlNodeAttribute(htmlNode, jsenvForceInlineAttribute)
    return true
  }
  return false
}
