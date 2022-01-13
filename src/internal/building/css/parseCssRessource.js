import {
  urlToFilename,
  urlToRelativeUrl,
  resolveUrl,
  fileSystemPathToUrl,
} from "@jsenv/filesystem"

import {
  generateSourcemapUrl,
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { getRessourceAsBase64Url } from "../ressource_builder_util.js"
import { parseCssUrls } from "./parseCssUrls.js"
import { replaceCssUrls } from "./replaceCssUrls.js"
import { moveCssUrls } from "./moveCssUrls.js"

export const parseCssRessource = async (
  cssRessource,
  { notifyReferenceFound },
  { asProjectUrl, asOriginalUrl, minify, minifyCssOptions, cssConcatenation },
) => {
  const cssString = String(cssRessource.bufferBeforeBuild)
  const cssSourcemapUrl = getCssSourceMappingUrl(cssString)
  const cssUrl = cssRessource.url
  let code = cssString
  let map
  let sourcemapReference
  if (cssSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceLabel: "css sourcemaping comment",
      contentTypeExpected: ["application/json", "application/octet-stream"],
      ressourceSpecifier: cssSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: cssString.split(/\r?\n/).length - 1,
      referenceColumn: 0,
      isSourcemap: true,
    })
    await sourcemapReference.ressource.getBufferAvailablePromise()
    map = JSON.parse(String(sourcemapReference.ressource.bufferBeforeBuild))
  } else {
    sourcemapReference = notifyReferenceFound({
      referenceLabel: "css sourcemaping comment",
      contentType: "application/octet-stream",
      ressourceSpecifier: urlToRelativeUrl(
        generateSourcemapUrl(cssUrl),
        cssUrl,
      ),
      isPlaceholder: true,
      isSourcemap: true,
    })
  }

  const { atImports, urlDeclarations } = await parseCssUrls({
    code,
    url: cssUrl,
  })
  const urlNodeReferenceMapping = new Map()
  const atImportReferences = []
  atImports.forEach((atImport) => {
    const importReference = notifyReferenceFound({
      referenceLabel: "css @import",
      ressourceSpecifier: atImport.specifier,
      ...cssNodeToReferenceLocation(atImport.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(atImport.urlNode, importReference)
    atImportReferences.push(importReference)
  })
  urlDeclarations.forEach((urlDeclaration) => {
    if (urlDeclaration.specifier[0] === "#") {
      return
    }
    const urlReference = notifyReferenceFound({
      referenceLabel: "css url",
      ressourceSpecifier: urlDeclaration.specifier,
      ...cssNodeToReferenceLocation(urlDeclaration.urlDeclarationNode),
    })
    urlNodeReferenceMapping.set(urlDeclaration.urlNode, urlReference)
  })

  return async ({
    getUrlRelativeToImporter,
    precomputeBuildRelativeUrl,
    buildDirectoryUrl,
  }) => {
    const sourcemapRessource = sourcemapReference.ressource
    const cssCompiledUrl = cssRessource.url
    const cssOriginalUrl = asOriginalUrl(cssCompiledUrl)

    const replaceCssResult = await replaceCssUrls({
      url: asProjectUrl(cssCompiledUrl),
      code,
      map,
      urlVisitor: ({ urlNode }) => {
        const nodeCandidates = Array.from(urlNodeReferenceMapping.keys())
        const urlNodeFound = nodeCandidates.find((urlNodeCandidate) =>
          isSameCssDocumentUrlNode(urlNodeCandidate, urlNode),
        )
        if (!urlNodeFound) {
          return urlNode.value
        }

        // url node nous dit quel référence y correspond
        const urlNodeReference = urlNodeReferenceMapping.get(urlNodeFound)
        const cssUrlRessource = urlNodeReference.ressource

        const { isExternal } = cssUrlRessource
        if (isExternal) {
          return urlNode.value
        }

        const { isInline } = cssUrlRessource
        if (isInline) {
          return getRessourceAsBase64Url(cssUrlRessource)
        }
        return getUrlRelativeToImporter(cssUrlRessource)
      },
      cssConcatenation,
      loadCssImport: async (path) => {
        // const cssFileUrl = asProjectUrl(url)
        const importedCssFileUrl = fileSystemPathToUrl(path)
        const atImportReference = atImportReferences.find(
          (atImportReference) => {
            return (
              asProjectUrl(atImportReference.ressource.url) ===
              importedCssFileUrl
            )
          },
        )
        atImportReference.inlinedCallback()
        let code = String(atImportReference.ressource.bufferAfterBuild)
        const moveResult = await moveCssUrls({
          code,
          from: resolveUrl(
            atImportReference.ressource.buildRelativeUrl,
            buildDirectoryUrl,
          ),
          to: resolveUrl(
            precomputeBuildRelativeUrl(cssRessource),
            buildDirectoryUrl,
          ),
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
        return code
      },
      cssMinification: minify,
      cssMinificationOptions: minifyCssOptions,
    })
    code = replaceCssResult.code
    map = replaceCssResult.map

    cssRessource.buildEnd(code)

    // In theory code should never be modified once buildEnd() is called
    // because buildRelativeUrl might be versioned based on file content
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the css file.
    // To achieve that we set/update the sourceMapping url comment in compiled css file.
    // This is totally fine to do that because sourcemap and css file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide buildRelativeUrl for this css file.
    const cssBuildUrl = resolveUrl(
      cssRessource.buildRelativeUrl,
      buildDirectoryUrl,
    )
    const sourcemapPrecomputedBuildUrl = generateSourcemapUrl(cssBuildUrl)
    map.file = urlToFilename(cssBuildUrl)
    if (map.sources) {
      map.sources = map.sources.map((source) => {
        const sourceUrl = resolveUrl(source, cssOriginalUrl)
        const sourceUrlRelativeToSourceMap = urlToRelativeUrl(
          sourceUrl,
          sourcemapPrecomputedBuildUrl,
        )
        return sourceUrlRelativeToSourceMap
      })
    }
    const mapSource = JSON.stringify(map, null, "  ")
    sourcemapRessource.buildEnd(mapSource)

    const sourcemapBuildUrl = resolveUrl(
      sourcemapRessource.buildRelativeUrl,
      buildDirectoryUrl,
    )
    const sourcemapUrlForCss = urlToRelativeUrl(sourcemapBuildUrl, cssBuildUrl)
    const codeWithSourcemapComment = setCssSourceMappingUrl(
      code,
      sourcemapUrlForCss,
    )
    cssRessource.bufferAfterBuild = codeWithSourcemapComment
  }
}

const cssNodeToReferenceLocation = (node) => {
  const { line, column } = node.source.start
  return {
    referenceLine: line,
    referenceColumn: column,
  }
}

const isSameCssDocumentUrlNode = (firstUrlNode, secondUrlNode) => {
  if (!compareUrlNodeTypes(firstUrlNode.type, secondUrlNode.type)) {
    return false
  }
  if (!compareUrlNodeValue(firstUrlNode.value, secondUrlNode.value)) {
    return false
  }
  // maybe this sourceIndex should be removed in case there is some css transformation one day?
  // it does not seems to change though as if it was refering the original file source index
  if (firstUrlNode.sourceIndex !== secondUrlNode.sourceIndex) {
    return false
  }
  return true
}

// minification may change url node type from string to word
// that's still the same node
const compareUrlNodeTypes = (firstUrlNodeType, secondUrlNodeType) => {
  if (firstUrlNodeType === secondUrlNodeType) {
    return true
  }
  if (firstUrlNodeType === "word" && secondUrlNodeType === "string") {
    return true
  }
  if (firstUrlNodeType === "string" && secondUrlNodeType === "word") {
    return true
  }
  return false
}

// minification may change url node value from './whatever.png' to 'whatever.png'
// the value still revolves to the same ressource
const compareUrlNodeValue = (firstUrlNodeValue, secondUrlNodeValue) => {
  const firstValueNormalized = urlToRelativeUrl(
    resolveUrl(firstUrlNodeValue, "file:///"),
    "file:///",
  )
  const secondValueNormalized = urlToRelativeUrl(
    resolveUrl(secondUrlNodeValue, "file:///"),
    "file:///",
  )
  return firstValueNormalized === secondValueNormalized
}
