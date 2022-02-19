/**

Finds all asset reference in html then update all references to target the files in dist/ when needed.

There is some cases where the asset won't be found and updated:
- inline style attributes

Don't write the following for instance:
```html
<div style="background:url('img.png')"></div>
```
*/

import { urlToFilename, urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"
import { applyAlgoToRepresentationData } from "@jsenv/integrity"

import {
  parseHtmlString,
  getHtmlNodeAttributeByName,
  stringifyHtmlAst,
  getIdForInlineHtmlNode,
  removeHtmlNodeAttribute,
  getHtmlNodeTextNode,
  getHtmlNodeLocation,
  removeHtmlNode,
  assignHtmlNodeAttributes,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { htmlAttributeSrcSet } from "@jsenv/core/src/internal/transform_html/html_attribute_src_set.js"
import {
  inlineLinkStylesheet,
  inlineScript,
} from "@jsenv/core/src/internal/transform_html/html_inlining.js"
import { moveCssUrls } from "@jsenv/core/src/internal/transform_css/move_css_urls.js"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourcemap_utils.js"

import {
  getRessourceAsBase64Url,
  isReferencedOnlyByRessourceHint,
} from "../ressource_builder_util.js"
import { imageHrefVisitor, useHrefVisitor } from "../svg/parse_svg.js"
import { collectHtmlMutations } from "./html_node_mutations.js"

export const parseHtmlRessource = async (
  htmlRessource,
  {
    format,
    notifyReferenceFound,
    minify,
    minifyHtml,
    htmlStringToHtmlAst = (htmlString) => parseHtmlString(htmlString),
    htmlAstToHtmlString = (htmlAst) => stringifyHtmlAst(htmlAst),
    ressourceHintNeverUsedCallback = () => {},
  } = {},
) => {
  const htmlString = String(htmlRessource.bufferBeforeBuild)
  const htmlAst = await htmlStringToHtmlAst(htmlString)
  const candidates = [
    aHrefVisitor,
    linkStylesheetHrefVisitor,
    linkHrefVisitor,
    // we won't check classic script content, they will be handled as "assets"
    // but we will still inline/minify/hash them
    classicScriptSrcVisitor,
    classicScriptTextNodeVisitor,
    moduleScriptSrcVisitor,
    moduleScriptTextNodeVisitor,
    importmapScriptSrcVisitor,
    importmapScriptTextNodeVisitor,
    styleTextNodeVisitor,
    imgSrcVisitor,
    sourceSrcVisitor,
    imgOrSourceSrcsetVisitor,
    imageHrefVisitor,
    useHrefVisitor,
  ]
  const htmlMutations = collectHtmlMutations(htmlAst, candidates, {
    htmlAst,
    htmlRessource,
    format,
    notifyReferenceFound,
    ressourceHintNeverUsedCallback,
  })
  return async (params) => {
    await htmlMutations.reduce(async (previous, mutationCallback) => {
      await previous
      await mutationCallback({
        ...params,
      })
    }, Promise.resolve())
    const htmlAfterTransformation = htmlAstToHtmlString(htmlAst)
    const html = minify
      ? await minifyHtml(htmlAfterTransformation)
      : htmlAfterTransformation
    htmlRessource.buildEnd(html)
  }
}

const aHrefVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "a") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  const href = hrefAttribute ? hrefAttribute.value : undefined
  if (!href) {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  const type = typeAttribute ? typeAttribute.value : undefined
  const reference = notifyReferenceFound({
    referenceLabel: "a href",
    contentTypeExpected: type,
    ressourceSpecifier: href,
    ...referenceLocationFromHtmlNode(node, "href"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = reference
    if (ressource.isPreserved) {
      return
    }
    const downloadAttribute = getHtmlNodeAttributeByName(node, "download")
    if (downloadAttribute && downloadAttribute.value === "") {
      downloadAttribute.value = urlToFilename(ressource.url)
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    hrefAttribute.value = urlRelativeToImporter
  }
}

const linkStylesheetHrefVisitor = (
  node,
  { htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "link") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  if (!hrefAttribute) {
    return null
  }
  const relAttribute = getHtmlNodeAttributeByName(node, "rel")
  if (!relAttribute) {
    return null
  }
  if (relAttribute.value !== "stylesheet") {
    return null
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const cssReference = notifyReferenceFound({
    referenceLabel: "html stylesheet link",
    contentTypeExpected: "text/css",
    ressourceSpecifier: hrefAttribute.value,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "href"),
  })
  return async ({ getUrlRelativeToImporter, buildDirectoryUrl }) => {
    const { ressource } = cssReference
    if (ressource.isPreserved) {
      return
    }
    if (shouldInline({ ressource, htmlNode: node })) {
      const { buildRelativeUrl } = ressource
      const cssBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
      const htmlBuildUrl = resolveUrl(
        htmlRessource.buildRelativeUrlWithoutHash,
        buildDirectoryUrl,
      )
      const { bufferAfterBuild } = ressource
      let content = String(bufferAfterBuild)
      const moveResult = await moveCssUrls({
        from: cssBuildUrl,
        to: htmlBuildUrl,
        // moveCssUrls will change the css source code
        // Ideally we should update the sourcemap referenced by css
        // to target the one after css urls are moved.
        // It means we should force sourcemap ressource to the new one
        // until it's supported we prevent postcss from updating the
        // sourcemap comment, othwise css would reference a sourcemap
        // that won't by in the build directory
        sourcemapMethod: null,
        content,
      })
      content = moveResult.content
      const sourcemapRelativeUrl = getCssSourceMappingUrl(content)
      if (sourcemapRelativeUrl) {
        const cssBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
        const sourcemapBuildUrl = resolveUrl(sourcemapRelativeUrl, cssBuildUrl)
        const sourcemapInlineUrl = urlToRelativeUrl(
          sourcemapBuildUrl,
          htmlBuildUrl,
        )
        content = setCssSourceMappingUrl(content, sourcemapInlineUrl)
      }
      inlineLinkStylesheet(node, content)
      cssReference.inlinedCallback()
      return
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    hrefAttribute.value = urlRelativeToImporter
    if (integrityAttribute) {
      const base64Value = applyAlgoToRepresentationData(
        "sha256",
        ressource.bufferAfterBuild,
      )
      integrityAttribute.value = `sha256-${base64Value}`
    }
  }
}

const linkHrefVisitor = (
  node,
  { format, notifyReferenceFound, ressourceHintNeverUsedCallback },
) => {
  if (node.nodeName !== "link") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  if (!hrefAttribute) {
    return null
  }
  const href = hrefAttribute.value
  const relAttribute = getHtmlNodeAttributeByName(node, "rel")
  const rel = relAttribute ? relAttribute.value : undefined
  const isRessourceHint = [
    "preconnect",
    "dns-prefetch",
    "prefetch",
    "preload",
    "modulepreload",
  ].includes(rel)
  let contentTypeExpected
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  const type = typeAttribute ? typeAttribute.value : ""
  let isJsModule = false
  if (type) {
    contentTypeExpected = type
  } else if (rel === "manifest") {
    contentTypeExpected = "application/manifest+json"
  } else if (rel === "modulepreload") {
    contentTypeExpected = "application/javascript"
    isJsModule = true
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const linkReference = notifyReferenceFound({
    referenceLabel: rel ? `html ${rel} link href` : `html link href`,
    isRessourceHint,
    contentTypeExpected,
    ressourceSpecifier: href,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "href"),
    urlVersioningDisabled: contentTypeExpected === "application/manifest+json",
    isJsModule,
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = linkReference
    if (isRessourceHint) {
      if (isReferencedOnlyByRessourceHint(ressource)) {
        ressourceHintNeverUsedCallback({
          htmlNode: node,
          rel,
          href: hrefAttribute.value,
          htmlAttributeName: "href",
        })
        // we could remove the HTML node but better keep it untouched and let user decide what to do
        return
      }
      ressource.inlinedCallbacks.push(() => {
        removeHtmlNode(node)
      })
    }
    if (ressource.isPreserved) {
      return
    }
    if (format === "systemjs" && rel === "modulepreload") {
      const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
      relAttribute.value = "preload"
      hrefAttribute.value = urlRelativeToImporter
      assignHtmlNodeAttributes(node, { as: "script" })
      return
    }
    if (shouldInline({ ressource, htmlNode: node })) {
      removeHtmlNode(node)
      linkReference.inlinedCallback()
      return
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    hrefAttribute.value = urlRelativeToImporter
    if (integrityAttribute) {
      const base64Value = applyAlgoToRepresentationData(
        "sha256",
        ressource.bufferAfterBuild,
      )
      integrityAttribute.value = `sha256-${base64Value}`
    }
  }
}

const classicScriptSrcVisitor = (
  node,
  { htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" ||
      typeAttribute.value !== "application/javascript")
  ) {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return null
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const remoteScriptReference = notifyReferenceFound({
    referenceLabel: "html script",
    contentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const ressource = remoteScriptReference.ressource
    if (ressource.isPreserved) {
      return
    }
    if (shouldInline({ ressource, htmlNode: node })) {
      const { bufferAfterBuild } = ressource
      let jsString = String(bufferAfterBuild)

      const sourcemapRelativeUrl = getJavaScriptSourceMappingUrl(jsString)
      if (sourcemapRelativeUrl) {
        const { buildRelativeUrl } = ressource
        const jsBuildUrl = resolveUrl(buildRelativeUrl, "file:///")
        const sourcemapBuildUrl = resolveUrl(sourcemapRelativeUrl, jsBuildUrl)
        const htmlUrl = resolveUrl(htmlRessource.fileNamePattern, "file:///")
        const sourcemapInlineUrl = urlToRelativeUrl(sourcemapBuildUrl, htmlUrl)
        jsString = setJavaScriptSourceMappingUrl(jsString, sourcemapInlineUrl)
      }
      inlineScript(node, jsString)
      remoteScriptReference.inlinedCallback()
      return
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    srcAttribute.value = urlRelativeToImporter
    if (integrityAttribute) {
      const base64Value = applyAlgoToRepresentationData(
        "sha256",
        ressource.bufferAfterBuild,
      )
      integrityAttribute.value = `sha256-${base64Value}`
    }
  }
}

const classicScriptTextNodeVisitor = (
  node,
  { htmlAst, htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (
    typeAttribute &&
    (typeAttribute.value !== "text/javascript" ||
      typeAttribute.value !== "application/javascript")
  ) {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(node)
  if (!textNode) {
    return null
  }
  const scriptId = getIdForInlineHtmlNode(htmlAst, node)
  const ressourceSpecifier = `${urlToFilename(
    htmlRessource.url,
  )}__inline__${scriptId}.js`
  const jsReference = notifyReferenceFound({
    referenceLabel: "html inline script",
    contentTypeExpected: "application/javascript",
    ressourceSpecifier,
    ...referenceLocationFromHtmlNode(node),
    contentType: "application/javascript",
    bufferBeforeBuild: Buffer.from(textNode.value),
    isInline: true,
  })
  return () => {
    const { bufferAfterBuild } = jsReference.ressource
    textNode.value = String(bufferAfterBuild)
  }
}

const moduleScriptSrcVisitor = (node, { format, notifyReferenceFound }) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "module") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return null
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const remoteScriptReference = notifyReferenceFound({
    referenceLabel: "html module script",
    contentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "src"),
    isJsModule: true,
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = remoteScriptReference
    if (format === "systemjs") {
      removeHtmlNodeAttribute(node, typeAttribute)
    }
    if (ressource.isPreserved) {
      return
    }
    if (shouldInline({ ressource, htmlNode: node })) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      const { bufferAfterBuild } = ressource
      let jsString = String(bufferAfterBuild)

      // at this stage, for some reason the sourcemap url is not in the js
      // (it will be added shortly after by "injectSourcemapInRollupBuild")
      // but we know that a script type module have a sourcemap
      // and will be next to html file
      // with these assumptions we can force the sourcemap url
      const sourcemapUrl = `${ressource.buildRelativeUrl}.map`
      jsString = setJavaScriptSourceMappingUrl(jsString, sourcemapUrl)
      inlineScript(node, jsString)
      remoteScriptReference.inlinedCallback()
      return
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter)
    srcAttribute.value = relativeUrlNotation
    if (integrityAttribute) {
      const base64Value = applyAlgoToRepresentationData(
        "sha256",
        ressource.bufferAfterBuild,
      )
      integrityAttribute.value = `sha256-${base64Value}`
    }
  }
}

const moduleScriptTextNodeVisitor = (
  node,
  { format, htmlAst, htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "module") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(node)
  if (!textNode) {
    return null
  }
  const scriptId = getIdForInlineHtmlNode(htmlAst, node)
  const ressourceSpecifier = `${urlToFilename(
    htmlRessource.url,
  )}__inline__${scriptId}.js`
  const jsReference = notifyReferenceFound({
    referenceLabel: "html inline module script",
    contentTypeExpected: "application/javascript",
    ressourceSpecifier,
    ...referenceLocationFromHtmlNode(node),
    contentType: "application/javascript",
    bufferBeforeBuild: textNode.value,
    isJsModule: true,
    isInline: true,
  })
  return () => {
    if (format === "systemjs") {
      removeHtmlNodeAttribute(node, typeAttribute)
    }
    const { bufferAfterBuild } = jsReference.ressource
    const jsText = String(bufferAfterBuild)
    textNode.value = jsText
  }
}

const importmapScriptSrcVisitor = (node, { format, notifyReferenceFound }) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "importmap") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return null
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const importmapReference = notifyReferenceFound({
    referenceLabel: "html importmap",
    contentTypeExpected: "application/importmap+json",
    ressourceSpecifier: srcAttribute.value,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = importmapReference
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }
    if (ressource.isPreserved) {
      return
    }
    if (
      // for esmodule we always inline the importmap
      // as it's the only thing supported by Chrome
      // window.__resolveImportUrl__ also expects importmap to be inlined
      format === "esmodule" ||
      // for systemjs we inline as well to save http request for the scenario
      // where many ressources are inlined in the HTML file
      format === "systemjs" ||
      shouldInline({ ressource, htmlNode: node })
    ) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      const { bufferAfterBuild } = ressource
      const importmapString = String(bufferAfterBuild)
      inlineScript(node, importmapString)
      importmapReference.inlinedCallback()
      return
    }
    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
    srcAttribute.value = urlRelativeToImporter
    if (integrityAttribute) {
      const base64Value = applyAlgoToRepresentationData(
        "sha256",
        ressource.bufferAfterBuild,
      )
      integrityAttribute.value = `sha256-${base64Value}`
    }
  }
}

const importmapScriptTextNodeVisitor = (
  node,
  { format, htmlAst, htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "script") {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (!typeAttribute) {
    return null
  }
  if (typeAttribute.value !== "importmap") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
    return null
  }
  const textNode = getHtmlNodeTextNode(node)
  if (!textNode) {
    return null
  }
  const importmapScriptId = getIdForInlineHtmlNode(htmlAst, node)
  const importmapReference = notifyReferenceFound({
    referenceLabel: "html inline importmap",
    contentTypeExpected: "application/importmap+json",
    ressourceSpecifier: `${urlToFilename(
      htmlRessource.url,
    )}__inline__${importmapScriptId}.importmap`,
    ...referenceLocationFromHtmlNode(node),
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

const styleTextNodeVisitor = (
  node,
  { htmlAst, htmlRessource, notifyReferenceFound },
) => {
  if (node.nodeName !== "style") {
    return null
  }
  const textNode = getHtmlNodeTextNode(node)
  if (!textNode) {
    return null
  }
  const styleId = getIdForInlineHtmlNode(htmlAst, node)
  const inlineStyleReference = notifyReferenceFound({
    referenceLabel: "html style",
    contentTypeExpected: "text/css",
    ressourceSpecifier: `${urlToFilename(
      htmlRessource.url,
    )}__inline__${styleId}.css`,
    ...referenceLocationFromHtmlNode(node),
    contentType: "text/css",
    bufferBeforeBuild: Buffer.from(textNode.value),
    isInline: true,
  })
  return () => {
    const { bufferAfterBuild } = inlineStyleReference.ressource
    textNode.value = bufferAfterBuild
  }
}

const imgSrcVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName === "img") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return null
  }
  const srcReference = notifyReferenceFound({
    referenceLabel: "html img src",
    ressourceSpecifier: srcAttribute.value,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: node,
      getUrlRelativeToImporter,
    })
    srcAttribute.value = srcNewValue
  }
}

const imgOrSourceSrcsetVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "img" && node.nodeName !== "source") {
    return null
  }
  const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset")
  if (!srcsetAttribute) {
    return null
  }
  const srcCandidates = htmlAttributeSrcSet.parse(srcsetAttribute.value)
  const srcReferences = srcCandidates.map(({ specifier }, index) =>
    notifyReferenceFound({
      referenceLabel: `html srcset ${index}`,
      ressourceSpecifier: specifier,
      ...crossoriginFromHtmlNode(node),
      ...referenceLocationFromHtmlNode(node, "srcset"),
    }),
  )
  if (srcCandidates.length === 0) {
    return null
  }
  return ({ getUrlRelativeToImporter }) => {
    srcCandidates.forEach((srcCandidate, index) => {
      const reference = srcReferences[index]
      srcCandidate.specifier = referenceToUrl({
        reference,
        htmlNode: node,
        getUrlRelativeToImporter,
      })
    })
    const srcsetNewValue = htmlAttributeSrcSet.stringify(srcCandidates)
    srcsetAttribute.value = srcsetNewValue
  }
}

const sourceSrcVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "source") {
    return null
  }
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return null
  }
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  const srcReference = notifyReferenceFound({
    referenceLabel: "html source",
    contentTypeExpected: typeAttribute ? typeAttribute.value : undefined,
    ressourceSpecifier: srcAttribute.value,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: node,
      getUrlRelativeToImporter,
    })
    srcAttribute.value = srcNewValue
  }
}

const referenceToUrl = ({ reference, htmlNode, getUrlRelativeToImporter }) => {
  const { ressource } = reference
  if (ressource.isPreserved) {
    return ressource.url
  }
  if (shouldInline({ ressource, htmlNode })) {
    reference.inlinedCallback()
    return getRessourceAsBase64Url(ressource)
  }
  return getUrlRelativeToImporter(ressource)
}

const crossoriginFromHtmlNode = (htmlNode) => {
  const crossOriginAttribute = getHtmlNodeAttributeByName(
    htmlNode,
    "crossorigin",
  )
  const crossorigin = crossOriginAttribute ? crossOriginAttribute.value : ""
  return { crossorigin }
}

const referenceLocationFromHtmlNode = (htmlNode, htmlAttributeName) => {
  const locInfo = getHtmlNodeLocation(htmlNode, htmlAttributeName)
  return locInfo
    ? {
        referenceLine: locInfo.line,
        referenceColumn: locInfo.column,
      }
    : {}
}

// otherwise systemjs handle it as a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}

const shouldInline = ({ ressource, htmlNode }) => {
  if (ressource.isInline) {
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
