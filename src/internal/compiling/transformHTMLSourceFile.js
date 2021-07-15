/**
 * Send a modified version of the html files instead of serving
 * the source html files
 * This is to force inlining of importmap
 */

import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { moveImportMap } from "@jsenv/import-map"
import { createDetailedMessage } from "@jsenv/logger"

import { jsenvToolbarInjectorFileInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  replaceHtmlNode,
  stringifyHtmlAst,
  manipulateHtmlAst,
} from "./compileHtml.js"

export const transformHTMLSourceFile = async ({
  logger,
  projectDirectoryUrl,
  fileUrl,
  fileContent,
  inlineImportMapIntoHTML,
  jsenvToolbarInjection, // for toolbar
}) => {
  const htmlAst = parseHtmlString(fileContent)
  if (inlineImportMapIntoHTML) {
    await inlineImportmapScripts({
      logger,
      htmlAst,
      fileUrl,
      projectDirectoryUrl,
    })
  }

  const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarInjectorFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      ...(jsenvToolbarInjection && fileUrl !== jsenvToolbarInjectorFileInfo.url
        ? [
            {
              src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
            },
          ]
        : []),
    ],
  })
  // il faudrait aussi transformer tous les script type module en script normaux utilisant un
  // import dynamique et écrire ce résultat dans window.__jsenv__.executionResultPromise
  return stringifyHtmlAst(htmlAst)
}

const inlineImportmapScripts = async ({ logger, htmlAst, fileUrl }) => {
  const { scripts } = parseHtmlAstRessources(htmlAst)
  const remoteImportmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    if (typeAttribute && typeAttribute.value === "importmap" && srcAttribute) {
      return true
    }
    return false
  })

  await Promise.all(
    remoteImportmapScripts.map(async (remoteImportmapScript) => {
      const srcAttribute = getHtmlNodeAttributeByName(remoteImportmapScript, "src")
      const importMapUrl = resolveUrl(srcAttribute.value, fileUrl)
      const importMapResponse = await fetchUrl(importMapUrl)
      if (importMapResponse.status !== 200) {
        logger.warn(
          createDetailedMessage(
            importMapResponse.status === 404
              ? `Cannot inline importmap script because file cannot be found.`
              : `Cannot inline importmap script due to unexpected response status (${importMapResponse.status}).`,
            {
              "importmap script src": srcAttribute.value,
              "importmap url": importMapUrl,
              "html url": fileUrl,
            },
          ),
        )

        return
      }

      const importMapContent = await importMapResponse.json()
      const importMapInlined = moveImportMap(importMapContent, importMapUrl, fileUrl)
      replaceHtmlNode(
        remoteImportmapScript,
        `<script type="importmap">${JSON.stringify(importMapInlined, null, "  ")}</script>`,
      )
    }),
  )
}
