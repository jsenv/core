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
  parseLinkNode,
  parseScriptNode,
  removeHtmlNodeAttributeByName,
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
import { imageVisitor, useVisitor } from "../svg/parse_svg.js"
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
    aVisitor,
    linkVisitor,
    styleVisitor,
    // we won't check classic script content, they will be handled as "assets"
    // but we will still inline/minify/hash them
    scriptVisitor,
    imgVisitor,
    sourceVisitor,
    imageVisitor,
    useVisitor,
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

const aVisitor = (node, { notifyReferenceFound }) => {
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

const linkVisitor = (
  node,
  {
    format,
    htmlRessource,
    notifyReferenceFound,
    ressourceHintNeverUsedCallback,
  },
) => {
  if (node.nodeName !== "link") {
    return null
  }
  const hrefAttribute = getHtmlNodeAttributeByName(node, "href")
  const href = hrefAttribute ? hrefAttribute.value : undefined
  if (!href) {
    return null
  }
  const integrityAttribute = getHtmlNodeAttributeByName(node, "integrity")
  const integrity = integrityAttribute ? integrityAttribute.value : ""
  const { isStylesheet, isRessourceHint, rel } = parseLinkNode(node)
  if (isStylesheet) {
    const linkReference = notifyReferenceFound({
      referenceLabel: `html stylesheet link`,
      contentTypeExpected: "text/css",
      ressourceSpecifier: href,
      integrity,
      ...crossoriginFromHtmlNode(node),
      ...referenceLocationFromHtmlNode(node, "href"),
    })
    return async ({ getUrlRelativeToImporter, buildDirectoryUrl }) => {
      const { ressource } = linkReference
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
          const sourcemapBuildUrl = resolveUrl(
            sourcemapRelativeUrl,
            cssBuildUrl,
          )
          const sourcemapInlineUrl = urlToRelativeUrl(
            sourcemapBuildUrl,
            htmlBuildUrl,
          )
          content = setCssSourceMappingUrl(content, sourcemapInlineUrl)
        }
        inlineLinkStylesheet(node, content)
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
  let contentTypeExpected
  let isJsModule = false
  let urlVersioningDisabled = false
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  const type = typeAttribute ? typeAttribute.value : ""
  if (type) {
    contentTypeExpected = type
  } else if (rel === "manifest") {
    contentTypeExpected = "application/manifest+json"
    urlVersioningDisabled = true
  } else if (rel === "modulepreload") {
    contentTypeExpected = "application/javascript"
    isJsModule = true
  }
  const linkReference = notifyReferenceFound({
    referenceLabel: rel ? `html ${rel} link href` : `html link href`,
    contentTypeExpected,
    ressourceSpecifier: href,
    integrity,
    ...crossoriginFromHtmlNode(node),
    ...referenceLocationFromHtmlNode(node, "href"),
    isJsModule,
    urlVersioningDisabled,
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
      assignHtmlNodeAttributes(node, {
        href: urlRelativeToImporter,
        rel: "preload",
        as: "script",
      })
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

const scriptVisitor = (node, { htmlRessource, notifyReferenceFound }) => {
  if (node.nodeName !== "script") {
    return null
  }
  const scriptCategory = parseScriptNode(node)
  if (scriptCategory === "classic") {
    return classicScriptVisitor(node, {
      htmlRessource,
      notifyReferenceFound,
    })
  }
  if (scriptCategory === "module") {
    return moduleScriptVisitor(node, {
      htmlRessource,
      notifyReferenceFound,
    })
  }
  if (scriptCategory === "importmap") {
    return importmapScriptVisitor(node, {
      htmlRessource,
      notifyReferenceFound,
    })
  }
  return null
}
const classicScriptVisitor = (
  node,
  { htmlAst, htmlRessource, notifyReferenceFound },
) => {
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
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
          const sourcemapInlineUrl = urlToRelativeUrl(
            sourcemapBuildUrl,
            htmlUrl,
          )
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
  const textNode = getHtmlNodeTextNode(node)
  if (textNode) {
    const textNode = getHtmlNodeTextNode(node)
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
  return null
}
const moduleScriptVisitor = (
  node,
  { format, htmlAst, htmlRessource, notifyReferenceFound },
) => {
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
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
        removeHtmlNodeAttributeByName(node, "type")
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
      const relativeUrlNotation = ensureRelativeUrlNotation(
        urlRelativeToImporter,
      )
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
  const textNode = getHtmlNodeTextNode(node)
  if (textNode) {
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
        removeHtmlNodeAttributeByName(node, "type")
      }
      const { bufferAfterBuild } = jsReference.ressource
      const jsText = String(bufferAfterBuild)
      textNode.value = jsText
    }
  }
  return null
}
const importmapScriptVisitor = (
  node,
  { format, htmlAst, htmlRessource, notifyReferenceFound },
) => {
  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (srcAttribute) {
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
        assignHtmlNodeAttributes(node, { type: "systemjs-importmap" })
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
  const textNode = getHtmlNodeTextNode(node)
  if (textNode) {
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
        assignHtmlNodeAttributes(node, { type: "systemjs-importmap" })
      }
      const { bufferAfterBuild } = importmapReference.ressource
      textNode.value = bufferAfterBuild
    }
  }
  return null
}

const styleVisitor = (
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

const imgVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName === "img") {
    return null
  }
  const visitImgSrc = () => {
    const srcAttribute = getHtmlNodeAttributeByName(node, "src")
    const src = srcAttribute ? srcAttribute.value : undefined
    if (!src) {
      return null
    }
    const srcReference = notifyReferenceFound({
      referenceLabel: "html img src",
      ressourceSpecifier: src,
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
  const visitImgSrcSet = () => {
    const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset")
    const srcset = srcsetAttribute ? srcsetAttribute.value : undefined
    if (!srcset) {
      return null
    }
    const srcCandidates = htmlAttributeSrcSet.parse(srcsetAttribute.value)
    const srcReferences = srcCandidates.map(({ specifier }, index) =>
      notifyReferenceFound({
        referenceLabel: `img srcset ${index}`,
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
  return [visitImgSrc(), visitImgSrcSet()]
}

const sourceVisitor = (node, { notifyReferenceFound }) => {
  if (node.nodeName !== "source") {
    return null
  }
  const visitSourceSrc = () => {
    const srcAttribute = getHtmlNodeAttributeByName(node, "src")
    const src = srcAttribute ? srcAttribute.value : undefined
    if (!src) {
      return null
    }
    const typeAttribute = getHtmlNodeAttributeByName(node, "type")
    const type = typeAttribute ? typeAttribute.value : undefined
    const srcReference = notifyReferenceFound({
      referenceLabel: "html source",
      contentTypeExpected: type,
      ressourceSpecifier: src,
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
  const visitSourceSrcSet = () => {
    const srcsetAttribute = getHtmlNodeAttributeByName(node, "srcset")
    const srcset = srcsetAttribute ? srcsetAttribute.value : undefined
    if (!srcset) {
      return null
    }
    const srcCandidates = htmlAttributeSrcSet.parse(srcsetAttribute.value)
    const srcReferences = srcCandidates.map(({ specifier }, index) =>
      notifyReferenceFound({
        referenceLabel: `source srcset ${index}`,
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
  return [visitSourceSrc(), visitSourceSrcSet()]
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
