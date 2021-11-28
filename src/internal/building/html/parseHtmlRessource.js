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
  urlToFilename,
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
  getHtmlNodeLocation,
  removeHtmlNode,
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
import { collectNodesMutations } from "../parsing.utils.js"

import { collectSvgMutations } from "../svg/parseSvgRessource.js"
import { moveCssUrls } from "../css/moveCssUrls.js"

export const parseHtmlRessource = async (
  htmlRessource,
  notifiers,
  {
    minify,
    minifyHtml,
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
    {
      ...notifiers,
      ressourceHintNeverUsedCallback,
    },
    htmlRessource,
    [linkStylesheetHrefVisitor, linkHrefVisitor],
  )
  const scriptsMutations = collectNodesMutations(
    scripts,
    {
      ...notifiers,
    },
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
    contentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    ...referenceLocationFromHtmlNode(script, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const ressource = remoteScriptReference.ressource

    if (ressource.isExternal) {
      return
    }

    if (shouldInline({ ressource, htmlNode: script })) {
      removeHtmlNodeAttribute(script, srcAttribute)
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

      setHtmlNodeText(script, jsString)
      remoteScriptReference.inlinedCallback()
      return
    }

    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
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

  const ressourceSpecifier = getUniqueNameForInlineHtmlNode(
    script,
    scripts,
    `${urlToFilename(htmlRessource.url)}__inline__[id].js`,
  )
  const jsReference = notifyReferenceFound({
    contentTypeExpected: "application/javascript",
    ressourceSpecifier,
    ...referenceLocationFromHtmlNode(script),
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
    contentTypeExpected: "application/javascript",
    ressourceSpecifier: srcAttribute.value,
    ...referenceLocationFromHtmlNode(script, "src"),
    isJsModule: true,
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = remoteScriptReference

    if (format === "systemjs") {
      removeHtmlNodeAttribute(script, typeAttribute)
    }

    if (ressource.isExternal) {
      return
    }

    if (shouldInline({ ressource, htmlNode: script })) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      removeHtmlNodeAttribute(script, srcAttribute)
      const { bufferAfterBuild } = ressource
      let jsString = String(bufferAfterBuild)

      // at this stage, for some reason the sourcemap url is not in the js
      // (it will be added sshortly after by "injectSourcemapInRollupBuild")
      // but we know that a script type module have a sourcemap
      // and will be next to html file
      // with these assumptions we can force the sourcemap url
      const sourcemapUrl = `${ressource.buildRelativeUrl}.map`
      jsString = setJavaScriptSourceMappingUrl(jsString, sourcemapUrl)

      setHtmlNodeText(script, jsString)
      remoteScriptReference.inlinedCallback()
      return
    }

    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
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

  const ressourceSpecifier = getUniqueNameForInlineHtmlNode(
    script,
    scripts,
    `${urlToFilename(htmlRessource.url)}__inline__[id].js`,
  )
  const jsReference = notifyReferenceFound({
    contentTypeExpected: "application/javascript",
    ressourceSpecifier,
    ...referenceLocationFromHtmlNode(script),
    contentType: "application/javascript",
    bufferBeforeBuild: textNode.value,
    isJsModule: true,
    isInline: true,
  })
  return () => {
    if (format === "systemjs") {
      removeHtmlNodeAttribute(script, typeAttribute)
    }
    const { bufferAfterBuild } = jsReference.ressource
    const jsText = String(bufferAfterBuild)
    // ici on voudrait pouvoir ajouter le commentaire de la sourcemap
    // sauf que cela se produit un poil plus tard je crois?
    textNode.value = jsText
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
    contentTypeExpected: "application/importmap+json",
    ressourceSpecifier: srcAttribute.value,
    ...referenceLocationFromHtmlNode(script, "src"),
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
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = importmapReference

    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap"
    }

    if (ressource.isExternal) {
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
      shouldInline({ ressource, htmlNode: script })
    ) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      const { bufferAfterBuild } = ressource

      const importmapString = String(bufferAfterBuild)
      replaceHtmlNode(
        script,
        `<script>
${importmapString}</script>`,
        {
          attributesToIgnore: ["src"],
        },
      )
      importmapReference.inlinedCallback()
      return
    }

    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
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
    contentTypeExpected: "application/importmap+json",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      script,
      scripts,
      `${urlToFilename(htmlRessource.url)}__inline__[id].importmap`,
    ),
    ...referenceLocationFromHtmlNode(script),

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
    contentTypeExpected: "text/css",
    ressourceSpecifier: hrefAttribute.value,
    ...referenceLocationFromHtmlNode(link, "href"),
  })
  return async ({
    getUrlRelativeToImporter,
    precomputeBuildRelativeUrl,
    buildDirectoryUrl,
  }) => {
    const { ressource } = cssReference

    if (ressource.isExternal) {
      return
    }

    if (shouldInline({ ressource, htmlNode: link })) {
      const { bufferAfterBuild } = ressource
      let code = String(bufferAfterBuild)
      const { buildRelativeUrl } = ressource
      const cssBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
      const htmlUrl = resolveUrl(
        precomputeBuildRelativeUrl(htmlRessource),
        buildDirectoryUrl,
      )

      const moveResult = await moveCssUrls({
        code,
        from: cssBuildUrl,
        to: htmlUrl,
        // moveCssUrls will change the css source code
        // Ideally we should update the sourcemap referenced by css
        // to target the one after css urls are moved.
        // It means we should force sourcemap ressource to the new one
        // until it's supported we prevent postcss from updating the
        // sourcemap comment, othwise css would reference a sourcemap
        // that won't by in the build directory
        sourcemapMethod: null,
      })
      code = moveResult.code

      const sourcemapRelativeUrl = getCssSourceMappingUrl(code)
      if (sourcemapRelativeUrl) {
        const cssBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)
        const sourcemapBuildUrl = resolveUrl(sourcemapRelativeUrl, cssBuildUrl)
        const sourcemapInlineUrl = urlToRelativeUrl(sourcemapBuildUrl, htmlUrl)
        code = setCssSourceMappingUrl(code, sourcemapInlineUrl)
      }

      replaceHtmlNode(link, `<style>${code}</style>`, {
        attributesToIgnore: ["href", "rel", "as", "crossorigin", "type"],
      })
      cssReference.inlinedCallback()
      return
    }

    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
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

  let contentTypeExpected
  const typeAttribute = getHtmlNodeAttributeByName(link, "type")
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

  const linkReference = notifyReferenceFound({
    isRessourceHint,
    contentTypeExpected,
    ressourceSpecifier: hrefAttribute.value,
    ...referenceLocationFromHtmlNode(link, "href"),
    urlVersioningDisabled: contentTypeExpected === "application/manifest+json",
    isJsModule,
  })
  return ({ getUrlRelativeToImporter }) => {
    const { ressource } = linkReference

    if (isRessourceHint) {
      if (isReferencedOnlyByRessourceHint(ressource)) {
        ressourceHintNeverUsedCallback({
          htmlNode: link,
          rel,
          href: hrefAttribute.value,
          htmlAttributeName: "href",
        })
        // we could remove the HTML node but better keep it untouched and let user decide what to do
        return
      }

      ressource.inlinedCallbacks.push(() => {
        removeHtmlNode(link)
      })
    }

    if (ressource.isExternal) {
      return
    }

    if (format === "systemjs" && rel === "modulepreload") {
      const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
      replaceHtmlNode(
        link,
        `<link rel="preload" href="${urlRelativeToImporter}" as="script" />`,
      )
      return
    }

    if (shouldInline({ ressource, htmlNode: link })) {
      replaceHtmlNode(
        link,
        `<link href="${getRessourceAsBase64Url(ressource)}" />`,
      )
      linkReference.inlinedCallback()
      return
    }

    const urlRelativeToImporter = getUrlRelativeToImporter(ressource)
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
    contentTypeExpected: "text/css",
    ressourceSpecifier: getUniqueNameForInlineHtmlNode(
      style,
      styles,
      `${urlToFilename(htmlRessource.url)}__inline__[id].css`,
    ),
    ...referenceLocationFromHtmlNode(style),

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
    ...referenceLocationFromHtmlNode(img, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: img,
      getUrlRelativeToImporter,
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
      ...referenceLocationFromHtmlNode(htmlNode, "srcset"),
    }),
  )
  if (srcsetParts.length === 0) {
    return null
  }

  return ({ getUrlRelativeToImporter }) => {
    srcsetParts.forEach((srcsetPart, index) => {
      const reference = srcsetPartsReferences[index]
      srcsetPart.specifier = referenceToUrl({
        reference,
        htmlNode,
        getUrlRelativeToImporter,
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
    contentTypeExpected: typeAttribute ? typeAttribute.value : undefined,
    ressourceSpecifier: srcAttribute.value,
    ...referenceLocationFromHtmlNode(source, "src"),
  })
  return ({ getUrlRelativeToImporter }) => {
    const srcNewValue = referenceToUrl({
      reference: srcReference,
      htmlNode: source,
      getUrlRelativeToImporter,
    })
    srcAttribute.value = srcNewValue
  }
}

const referenceToUrl = ({ reference, htmlNode, getUrlRelativeToImporter }) => {
  const { ressource } = reference
  if (ressource.isExternal) {
    return ressource.url
  }
  if (shouldInline({ ressource, htmlNode })) {
    reference.inlinedCallback()
    return getRessourceAsBase64Url(ressource)
  }
  return getUrlRelativeToImporter(ressource)
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
