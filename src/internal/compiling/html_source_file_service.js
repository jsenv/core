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

import {
  resolveUrl,
  urlToRelativeUrl,
  urlToExtension,
  readFile,
  urlToFilename,
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { composeTwoImportMaps, moveImportMap } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import {
  BROWSER_RUNTIME_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import-resolution/importmap_default.js"

import {
  parseHtmlString,
  parseHtmlAstRessources,
  collectHtmlDependenciesFromAst,
  getHtmlNodeAttributeByName,
  replaceHtmlNode,
  stringifyHtmlAst,
  manipulateHtmlAst,
  removeHtmlNodeAttribute,
  getHtmlNodeTextNode,
  setHtmlNodeText,
  getUniqueNameForInlineHtmlNode,
} from "./compileHtml.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"

const jsenvDistDirectoryUrl = new URL("./dist/", jsenvCoreDirectoryUrl).href

export const createTransformHtmlSourceFileService = ({
  logger,
  projectDirectoryUrl,
  projectFileRequestedCallback,
  inlineImportMapIntoHTML,
  jsenvScriptInjection,
  jsenvEventSourceClientInjection,
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

  return async (request, { pushResponse }) => {
    const { ressource } = request
    const relativeUrl = ressource.slice(1)
    const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)

    if (urlIsInsideOf(fileUrl, jsenvDistDirectoryUrl)) {
      return null
    }

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
    projectFileRequestedCallback(relativeUrl, request)
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
      request,
      pushResponse,
      inlineImportMapIntoHTML,
      jsenvScriptInjection,
      jsenvEventSourceClientInjection,
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
  request,
  pushResponse,
  inlineImportMapIntoHTML,
  jsenvScriptInjection,
  jsenvToolbarInjection,
  jsenvEventSourceClientInjection,
  onInlineModuleScript = () => {},
}) => {
  fileUrl = urlWithoutSearch(fileUrl)

  const htmlAst = parseHtmlString(fileContent)
  await visitImportmapScripts({
    logger,
    htmlAst,
    inlineImportMapIntoHTML,
    htmlFileUrl: fileUrl,
    projectDirectoryUrl,
  })

  const browserRuntimeBuildUrlRelativeToProject = urlToRelativeUrl(
    BROWSER_RUNTIME_BUILD_URL,
    projectDirectoryUrl,
  )

  const eventSourceClientBuildRelativeUrlForProject = urlToRelativeUrl(
    EVENT_SOURCE_CLIENT_BUILD_URL,
    projectDirectoryUrl,
  )

  const toolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    TOOLBAR_INJECTOR_BUILD_URL,
    projectDirectoryUrl,
  )

  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      ...(jsenvScriptInjection
        ? [
            {
              src: `/${browserRuntimeBuildUrlRelativeToProject}`,
            },
          ]
        : []),
      ...(jsenvEventSourceClientInjection
        ? [
            {
              src: `/${eventSourceClientBuildRelativeUrlForProject}`,
            },
          ]
        : []),
      ...(jsenvToolbarInjection
        ? [
            {
              src: `/${toolbarInjectorBuildRelativeUrlForProject}`,
              defer: "",
              async: "",
            },
          ]
        : []),
    ],
  })

  if (request.http2) {
    const htmlDependencies = collectHtmlDependenciesFromAst(htmlAst)
    htmlDependencies.forEach(({ specifier }) => {
      const requestUrl = resolveUrl(request.ressource, request.origin)
      const dependencyUrl = resolveUrl(specifier, requestUrl)
      if (!urlIsInsideOf(dependencyUrl, request.origin)) {
        // ignore external urls
        return
      }
      if (dependencyUrl.startsWith("data:")) {
        return
      }
      const dependencyRelativeUrl = urlToRelativeUrl(
        dependencyUrl,
        request.origin,
      )
      pushResponse({ path: `/${dependencyRelativeUrl}` })
    })
  }

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
          `window.__jsenv__.executeFileUsingDynamicImport(${JSON.stringify(
            srcAttribute.value,
          )})`,
        )
        return
      }
      // inline
      const textNode = getHtmlNodeTextNode(script)
      if (typeAttribute && typeAttribute.value === "module" && textNode) {
        const scriptIdentifier = getUniqueNameForInlineHtmlNode(
          script,
          scripts,
          `${urlToFilename(fileUrl)}__inline__[id].js`,
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

  await forceInlineRessources({
    logger,
    htmlAst,
    htmlFileUrl: fileUrl,
    projectDirectoryUrl,
  })

  return stringifyHtmlAst(htmlAst)
}

const visitImportmapScripts = async ({
  logger,
  inlineImportMapIntoHTML,
  htmlAst,
  htmlFileUrl,
}) => {
  const { scripts } = parseHtmlAstRessources(htmlAst)
  const importmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    if (typeAttribute && typeAttribute.value === "importmap") {
      return true
    }
    return false
  })

  await Promise.all(
    importmapScripts.map(async (importmapScript) => {
      const srcAttribute = getHtmlNodeAttributeByName(importmapScript, "src")
      if (srcAttribute && inlineImportMapIntoHTML) {
        const importMapUrl = resolveUrl(srcAttribute.value, htmlFileUrl)
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
                "html url": htmlFileUrl,
              },
            ),
          )
          return
        }

        const importMapContent = await importMapResponse.json()
        const importMapInlined = moveImportMap(
          importMapContent,
          importMapUrl,
          htmlFileUrl,
        )

        replaceHtmlNode(
          importmapScript,
          `<script type="importmap">${JSON.stringify(
            importMapInlined,
            null,
            "  ",
          )}</script>`,
          {
            attributesToIgnore: ["src"],
          },
        )
      }

      const textNode = getHtmlNodeTextNode(importmapScript)
      if (!srcAttribute && textNode) {
        const jsenvImportmap = getDefaultImportmap(htmlFileUrl)
        const htmlImportmap = JSON.parse(textNode.value)
        const importmap = composeTwoImportMaps(jsenvImportmap, htmlImportmap)
        textNode.value = JSON.stringify(importmap, null, "  ")
      }
    }),
  )
}

const forceInlineRessources = async ({
  htmlAst,
  htmlFileUrl,
  projectDirectoryUrl,
}) => {
  const { scripts, links, imgs } = parseHtmlAstRessources(htmlAst)

  const inlineOperations = []
  scripts.forEach((script) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(script)
    if (!forceInlineAttribute) {
      return
    }
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    if (!src) {
      return
    }
    inlineOperations.push({
      specifier: src,
      mutateHtml: async (response) => {
        replaceHtmlNode(script, `<script>${await response.text()}</script>`, {
          attributesToIgnore: ["src"],
        })
      },
    })
  })
  links.forEach((link) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(link)
    if (!forceInlineAttribute) {
      return
    }
    const relAttribute = getHtmlNodeAttributeByName(link, "rel")
    const rel = relAttribute ? relAttribute.value : ""
    if (rel !== "stylesheet") {
      return
    }
    const hrefAttribute = getHtmlNodeAttributeByName(link, "href")
    const href = hrefAttribute ? hrefAttribute.value : ""
    if (!href) {
      return
    }
    inlineOperations.push({
      specifier: href,
      mutateHtml: async (response) => {
        replaceHtmlNode(link, `<style>${await response.text()}</style>`, {
          attributesToIgnore: ["rel", "href"],
        })
      },
    })
  })
  imgs.forEach((img) => {
    const forceInlineAttribute = getJsenvForceInlineAttribute(img)
    if (!forceInlineAttribute) {
      return
    }
    const srcAttribute = getHtmlNodeAttributeByName(img, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    if (!src) {
      return
    }
    inlineOperations.push({
      specifier: src,
      mutateHtml: async (response) => {
        const responseArrayBuffer = await response.arrayBuffer()
        const responseAsBase64 = stringifyDataUrl({
          data: responseArrayBuffer,
          base64Flag: true,
          mediaType: response.headers["content-type"],
        })
        replaceHtmlNode(img, `<img src=${responseAsBase64} />`)
      },
    })
  })

  await Promise.all(
    inlineOperations.map(async (inlineOperation) => {
      const url = resolveUrl(inlineOperation.specifier, htmlFileUrl)
      if (!urlIsInsideOf(url, projectDirectoryUrl)) {
        return
      }
      const response = await fetchUrl(url)
      if (response.status !== 200) {
        return
      }
      await inlineOperation.mutateHtml(response)
    }),
  )
}

const getJsenvForceInlineAttribute = (htmlNode) => {
  const jsenvForceInlineAttribute = getHtmlNodeAttributeByName(
    htmlNode,
    "data-jsenv-force-inline",
  )
  return jsenvForceInlineAttribute
}

const urlWithoutSearch = (url) => {
  const urlObject = new URL(url)
  urlObject.search = ""
  return urlObject.href
}
