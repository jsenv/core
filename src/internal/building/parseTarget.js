import { composeTwoImportMaps } from "@jsenv/import-map"
import {
  parseHtmlString,
  htmlAstContains,
  htmlNodeIsScriptModule,
  manipulateHtmlAst,
  findFirstImportmapNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

import { parseHtmlAsset } from "./html/parseHtmlAsset.js"
import { parseImportmapAsset } from "./importmap/parseImportmapAsset.js"
import { parseSvgAsset } from "./svg/parseSvgAsset.js"
import { parseCssAsset } from "./css/parseCssAsset.js"
import { parseJsAsset } from "./js/parseJsAsset.js"
import { parseJsonAsset } from "./json/parseJsonAsset.js"
import { parseWebmanifest } from "./webmanifest/parseWebmanifest.js"

export const parseTarget = (
  target,
  notifiers,
  {
    format,
    systemJsUrl,
    useImportMapToImproveLongTermCaching,
    createImportMapForFilesUsedInJs,
    minify,
    minifyHtmlOptions,
    minifyCssOptions,
    minifyJsOptions,
  },
) => {
  const { targetContentType } = target
  if (targetContentType === "text/html") {
    return parseHtmlAsset(target, notifiers, {
      minify,
      minifyHtmlOptions,
      htmlStringToHtmlAst: (htmlString) => {
        const htmlAst = parseHtmlString(htmlString)

        // force presence of systemjs script if html contains a module script
        const injectSystemJsScriptIfNeeded = (htmlAst) => {
          if (format !== "systemjs") {
            return
          }

          const htmlContainsModuleScript = htmlAstContains(htmlAst, htmlNodeIsScriptModule)
          if (!htmlContainsModuleScript) {
            return
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [
              {
                src: systemJsUrl,
              },
            ],
          })
        }

        // force the presence of a fake+inline+empty importmap script
        // if html contains no importmap and we useImportMapToImproveLongTermCaching
        // this inline importmap will be transformed later to have top level remapping
        // required to target hashed js urls
        const injectImportMapScriptIfNeeded = (htmlAst) => {
          if (!useImportMapToImproveLongTermCaching) {
            return
          }
          if (findFirstImportmapNode(htmlAst)) {
            return
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [
              {
                type: "importmap",
                id: "jsenv-build-importmap",
                text: "{}",
              },
            ],
          })
        }

        injectSystemJsScriptIfNeeded(htmlAst)
        injectImportMapScriptIfNeeded(htmlAst)

        return htmlAst
      },
      transformImportmapTarget: (importmapTarget) => {
        if (!useImportMapToImproveLongTermCaching) {
          return
        }
        injectImportedFilesIntoImportMapTarget(
          importmapTarget,
          createImportMapForFilesUsedInJs(),
          minify,
        )
      },
    })
  }

  if (targetContentType === "text/css") {
    return parseCssAsset(target, notifiers, { minify, minifyCssOptions })
  }

  if (targetContentType === "application/importmap+json") {
    return parseImportmapAsset(target, notifiers, { minify })
  }

  if (
    targetContentType === "application/manifest+json" ||
    target.targetReferences[0].referenceExpectedContentType === "application/manifest+json"
  ) {
    return parseWebmanifest(target, notifiers, { minify })
  }

  if (targetContentType === "text/javascript" || targetContentType === "application/javascript") {
    return parseJsAsset(target, notifiers, { minify, minifyJsOptions })
  }

  if (targetContentType === "image/svg+xml") {
    return parseSvgAsset(target, notifiers, { minify, minifyHtmlOptions })
  }

  if (targetContentType === "application/json" || targetContentType.endsWith("+json")) {
    return parseJsonAsset(target, notifiers, { minify })
  }

  return null
}

const injectImportedFilesIntoImportMapTarget = (importmapTarget, importMapToInject, minify) => {
  const { targetBufferAfterTransformation } = importmapTarget
  const importMapOriginal = JSON.parse(targetBufferAfterTransformation)

  const importMap = composeTwoImportMaps(importMapOriginal, importMapToInject)
  importmapTarget.updateOnceReady({
    targetBufferAfterTransformation: minify
      ? JSON.stringify(importMap)
      : JSON.stringify(importMap, null, "  "),
  })
}
