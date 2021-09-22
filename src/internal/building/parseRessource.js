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

import { parseHtmlRessource } from "./html/parseHtmlRessource.js"
import { parseImportmapRessource } from "./importmap/parseImportmapRessource.js"
import { parseSvgRessource } from "./svg/parseSvgRessource.js"
import { parseCssRessource } from "./css/parseCssRessource.js"
import { parseJsRessource } from "./js/parseJsRessource.js"
import { parseJsonRessource } from "./json/parseJsonRessource.js"
import { parseWebmanifestRessource } from "./webmanifest/parseWebmanifestRessource.js"

export const parseRessource = (
  ressource,
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
  const { contentType } = ressource
  if (!contentType) {
    return null
  }

  if (contentType === "text/html") {
    return parseHtmlRessource(ressource, notifiers, {
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
          htmlSource: String(ressource.bufferBeforeBuild),
          htmlUrl: urlToOriginalFileUrl(ressource.url),
        })
      },
    })
  }

  if (contentType === "text/css") {
    return parseCssRessource(ressource, notifiers, {
      urlToOriginalServerUrl,
      minify,
      minifyCssOptions,
    })
  }

  if (contentType === "application/importmap+json") {
    return parseImportmapRessource(ressource, notifiers, {
      minify,
      importMapToInject: useImportMapToImproveLongTermCaching
        ? createImportMapForFilesUsedInJs()
        : undefined,
    })
  }

  if (
    contentType === "application/manifest+json" ||
    ressource.references[0].ressourceContentTypeExpected ===
      "application/manifest+json"
  ) {
    return parseWebmanifestRessource(ressource, notifiers, { minify })
  }

  if (
    contentType === "application/javascript" ||
    contentType === "text/javascript"
  ) {
    return parseJsRessource(ressource, notifiers, {
      urlToOriginalFileUrl,
      urlToOriginalServerUrl,
      minify,
      minifyJsOptions,
    })
  }

  if (contentType === "image/svg+xml") {
    return parseSvgRessource(ressource, notifiers, {
      minify,
      minifyHtmlOptions,
    })
  }

  if (contentType === "application/json" || contentType.endsWith("+json")) {
    return parseJsonRessource(ressource, notifiers, { minify })
  }

  return null
}
