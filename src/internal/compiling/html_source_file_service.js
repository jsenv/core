/**
 * Send a modified version of the html files instead of serving
 * the source html files
 * - force inlining of importmap
 * - inject a script into html head to have window.__jsenv__
 * - <script type="module" src="file.js">
 *   into
 *   <script type="module">
 *      window.__jsenv__.executeFileUsingDynamicImport('file.js')
 *   </script>
 */

import { resolveUrl, urlToRelativeUrl, urlToExtension, readFile, urlToBasename } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { moveImportMap } from "@jsenv/import-map"
import { createDetailedMessage } from "@jsenv/logger"

import {
  jsenvToolbarHtmlFileInfo,
  jsenvBrowserSystemFileInfo,
  jsenvToolbarInjectorFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  replaceHtmlNode,
  stringifyHtmlAst,
  manipulateHtmlAst,
  removeHtmlNodeAttribute,
  getHtmlNodeTextNode,
  setHtmlNodeText,
  getUniqueNameForInlineHtmlNode,
} from "./compileHtml.js"

export const createTransformHtmlSourceFileService = ({
  logger,
  projectDirectoryUrl,
  inlineImportMapIntoHTML,
  jsenvScriptInjection,
  jsenvToolbarInjection,
}) => {
  /**
   * htmlInlineScriptMap is composed as below
   * "file:///project_directory/index.html.10.js": {
   *   "htmlFileUrl": "file:///project_directory/index.html",
   *   "scriptContent": "console.log(`Hello world`)"
   * }
   * It is used to serve the inline script as if they where inside a file
   * Every time the html file is retransformed, the list of inline script inside it
   * are deleted so that when html file and page is reloaded, the inline script are updated
   */
  const htmlInlineScriptMap = new Map()

  return async (request) => {
    const { ressource } = request
    const relativeUrl = ressource.slice(1)
    const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)

    const inlineScript = htmlInlineScriptMap.get(fileUrl)
    if (inlineScript) {
      return {
        status: 200,
        headers: {
          "content-type": "application/javascript",
          "content-length": Buffer.byteLength(inlineScript.scriptContent),
        },
        body: inlineScript.scriptContent,
      }
    }

    if (urlToExtension(fileUrl) !== ".html") {
      return null
    }

    let fileContent
    try {
      fileContent = await readFile(fileUrl, { as: "string" })
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          status: 404,
        }
      }
      throw e
    }
    htmlInlineScriptMap.forEach((inlineScript, inlineScriptUrl) => {
      if (inlineScript.htmlFileUrl === fileUrl) {
        htmlInlineScriptMap.delete(inlineScriptUrl)
      }
    })
    const htmlTransformed = await transformHTMLSourceFile({
      logger,
      projectDirectoryUrl,
      fileUrl,
      fileContent,
      inlineImportMapIntoHTML,
      jsenvScriptInjection,
      jsenvToolbarInjection,
      onInlineModuleScript: ({ scriptContent, scriptIdentifier }) => {
        const inlineScriptUrl = resolveUrl(scriptIdentifier, fileUrl)
        htmlInlineScriptMap.set(inlineScriptUrl, {
          htmlFileUrl: fileUrl,
          scriptContent,
        })
      },
    })
    return {
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-length": Buffer.byteLength(htmlTransformed),
        "cache-control": "no-cache",
      },
      body: htmlTransformed,
    }
  }
}

const transformHTMLSourceFile = async ({
  logger,
  projectDirectoryUrl,
  fileUrl,
  fileContent,
  inlineImportMapIntoHTML,
  jsenvScriptInjection,
  jsenvToolbarInjection,
  onInlineModuleScript = () => {},
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

  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarInjectorFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      ...(jsenvScriptInjection
        ? [
            {
              src: `/${jsenvBrowserBuildUrlRelativeToProject}`,
            },
          ]
        : []),
      ...(jsenvToolbarInjection && fileUrl !== jsenvToolbarHtmlFileInfo.url
        ? [
            {
              src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
            },
          ]
        : []),
    ],
  })

  if (jsenvScriptInjection) {
    const { scripts } = parseHtmlAstRessources(htmlAst)
    scripts.forEach((script) => {
      const typeAttribute = getHtmlNodeAttributeByName(script, "type")
      const srcAttribute = getHtmlNodeAttributeByName(script, "src")

      // remote
      if (typeAttribute && typeAttribute.value === "module" && srcAttribute) {
        removeHtmlNodeAttribute(script, srcAttribute)
        setHtmlNodeText(
          script,
          `window.__jsenv__.executeFileUsingDynamicImport(${JSON.stringify(srcAttribute.value)})`,
        )
        return
      }
      // inline
      const textNode = getHtmlNodeTextNode(script)
      if (typeAttribute && typeAttribute.value === "module" && textNode) {
        const scriptIdentifier = getUniqueNameForInlineHtmlNode(
          script,
          scripts,
          `${urlToBasename(fileUrl)}_script_inline_[id].js`,
        )
        onInlineModuleScript({
          scriptContent: textNode.value,
          scriptIdentifier,
        })
        setHtmlNodeText(
          script,
          `window.__jsenv__.executeFileUsingDynamicImport(${JSON.stringify(
            `./${scriptIdentifier}`,
          )})`,
        )
        return
      }
    })
  }

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
