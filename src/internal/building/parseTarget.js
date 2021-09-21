import { urlToRelativeUrl } from "@jsenv/filesystem"

import {
  parseHtmlString,
  findHtmlNode,
  htmlNodeIsScriptModule,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  manipulateHtmlAst,
  findFirstImportMapNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { jsenvSystemJsFileInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"

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
    projectDirectoryUrl,
    format,
    systemJsUrl,
    urlToOriginalFileUrl,
    urlToOriginalServerUrl,
    ressourceHintNeverUsedCallback,
    useImportMapToImproveLongTermCaching,
    createImportMapForFilesUsedInJs,
    minify,
    minifyHtmlOptions,
    minifyCssOptions,
    minifyJsOptions,
  },
) => {
  const { ressourceContentType } = target
  if (!ressourceContentType) {
    return null
  }

  if (ressourceContentType === "text/html") {
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

          let hasModuleScript = false
          let hasInlineModuleScript = false
          findHtmlNode(htmlAst, (htmlNode) => {
            const isScriptModule = htmlNodeIsScriptModule(htmlNode)
            if (!isScriptModule) {
              return false
            }

            hasModuleScript = true

            const isInline =
              getHtmlNodeAttributeByName(htmlNode, "data-jsenv-force-inline") ||
              (!getHtmlNodeAttributeByName(htmlNode, "src") &&
                getHtmlNodeTextNode(htmlNode))
            if (!isInline) {
              return false
            }
            hasInlineModuleScript = true
            return true
          })

          if (!hasModuleScript) {
            return
          }

          // use our own version of systemjs by default
          // we should also detect if there is an inline script
          // and, in that case, inline systemjs instead of using the url
          if (typeof systemJsUrl === "undefined") {
            systemJsUrl = `/${urlToRelativeUrl(
              jsenvSystemJsFileInfo.url,
              projectDirectoryUrl,
            )}`
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [
              {
                id: "jsenv_inject_systemjs",
                src: systemJsUrl,
                ...(hasInlineModuleScript
                  ? { "data-jsenv-force-inline": true }
                  : {}),
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
          if (findFirstImportMapNode(htmlAst)) {
            return
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [
              {
                type: "importmap",
                id: "jsenv_inject_importmap",
                text: "{}",
              },
            ],
          })
        }

        injectSystemJsScriptIfNeeded(htmlAst)
        injectImportMapScriptIfNeeded(htmlAst)

        return htmlAst
      },
      ressourceHintNeverUsedCallback: (info) => {
        ressourceHintNeverUsedCallback({
          ...info,
          htmlSource: String(target.bufferBeforeBuild),
          htmlUrl: urlToOriginalFileUrl(target.targetUrl),
        })
      },
    })
  }

  if (ressourceContentType === "text/css") {
    return parseCssAsset(target, notifiers, {
      urlToOriginalServerUrl,
      minify,
      minifyCssOptions,
    })
  }

  if (ressourceContentType === "application/importmap+json") {
    return parseImportmapAsset(target, notifiers, {
      minify,
      importMapToInject: useImportMapToImproveLongTermCaching
        ? createImportMapForFilesUsedInJs()
        : undefined,
    })
  }

  if (
    ressourceContentType === "application/manifest+json" ||
    target.references[0].ressourceContentTypeExpected ===
      "application/manifest+json"
  ) {
    return parseWebmanifest(target, notifiers, { minify })
  }

  if (
    ressourceContentType === "application/javascript" ||
    ressourceContentType === "text/javascript"
  ) {
    return parseJsAsset(target, notifiers, {
      urlToOriginalFileUrl,
      urlToOriginalServerUrl,
      minify,
      minifyJsOptions,
    })
  }

  if (ressourceContentType === "image/svg+xml") {
    return parseSvgAsset(target, notifiers, { minify, minifyHtmlOptions })
  }

  if (
    ressourceContentType === "application/json" ||
    ressourceContentType.endsWith("+json")
  ) {
    return parseJsonAsset(target, notifiers, { minify })
  }

  return null
}
