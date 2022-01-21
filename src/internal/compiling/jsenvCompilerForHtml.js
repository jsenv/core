import {
  resolveUrl,
  urlToFilename,
  urlToRelativeUrl,
  urlIsInsideOf,
} from "@jsenv/filesystem"
import { moveImportMap, composeTwoImportMaps } from "@jsenv/importmap"
import { createDetailedMessage } from "@jsenv/logger"

import { jsenvDistDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  BROWSER_RUNTIME_BUILD_URL,
  EVENT_SOURCE_CLIENT_BUILD_URL,
  TOOLBAR_INJECTOR_BUILD_URL,
} from "@jsenv/core/dist/build_manifest.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import-resolution/importmap_default.js"

import {
  generateSourcemapUrl,
  setJavaScriptSourceMappingUrl,
  sourcemapToBase64Url,
} from "../sourceMappingURLUtils.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  collectHtmlDependenciesFromAst,
  manipulateHtmlAst,
  stringifyHtmlAst,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  getIdForInlineHtmlNode,
  removeHtmlNodeAttribute,
  setHtmlNodeText,
  visitHtmlAst,
  addHtmlNodeAttribute,
} from "./compileHtml.js"
import { generateCompilationAssetUrl } from "./jsenv_directory/compile_asset.js"

export const compileHtml = async ({
  // cancellationToken,
  logger,
  url,
  compiledUrl,
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  compileId,
  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  jsenvScriptInjection = true,
  jsenvEventSourceClientInjection,
  jsenvToolbarInjection,
  onHtmlImportmapInfo,

  sourcemapMethod,
  code,
}) => {
  const compileDirectoryUrl = `${projectDirectoryUrl}${outDirectoryRelativeUrl}${compileId}/`
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

  // ideally we should try/catch html syntax error
  const htmlAst = parseHtmlString(code)
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

  const sources = []
  const sourcesContent = []
  const assets = []
  const assetsContent = []

  const addHtmlSourceFile = ({ url, content }) => {
    sources.push(url)
    sourcesContent.push(content)
  }
  addHtmlSourceFile({ url, content: code })

  const { scripts } = parseHtmlAstRessources(htmlAst)
  const htmlDependencies = collectHtmlDependenciesFromAst(htmlAst)

  const htmlAssetGenerators = []
  const htmlMutations = []
  const addHtmlAssetGenerator = (htmlAssetGenerator) => {
    htmlAssetGenerators.push(htmlAssetGenerator)
  }
  const addHtmlMutation = (htmlMutation) => {
    htmlMutations.push(htmlMutation)
  }
  const addHtmlDependency = ({ htmlNode, specifier }) => {
    htmlDependencies.push({
      htmlNode,
      specifier,
    })
  }
  if (moduleOutFormat !== "esmodule") {
    const ressourceHints = collectRessourceHints(htmlAst)
    await visitRessourceHints({
      ressourceHints,
      addHtmlMutation,
    })
  }
  await visitImportmapScript({
    htmlAst,
    logger,
    url,
    compiledUrl,
    projectDirectoryUrl,
    compileDirectoryUrl,
    moduleOutFormat,
    scripts,
    addHtmlMutation,
    addHtmlSourceFile,
    onHtmlImportmapInfo,
  })
  await visitScripts({
    logger,
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    compileServerOrigin,
    url,
    compiledUrl,

    babelPluginMap,
    moduleOutFormat,
    importMetaFormat,
    topLevelAwait,
    sourcemapMethod,

    scripts,
    addHtmlSourceFile,
    addHtmlAssetGenerator,
    addHtmlMutation,
    addHtmlDependency,
  })
  await Promise.all(
    htmlAssetGenerators.map(async (htmlAssetGenerator) => {
      const assetInfos = await htmlAssetGenerator()
      assetInfos.forEach((assetInfo) => {
        assets.push(assetInfo.url)
        assetsContent.push(assetInfo.content)
      })
    }),
  )
  htmlAssetGenerators.length = 0
  htmlMutations.forEach((htmlMutation) => {
    htmlMutation()
  })
  htmlMutations.length = 0
  const htmlAfterTransformation = stringifyHtmlAst(htmlAst)
  return {
    contentType: "text/html",
    compiledSource: htmlAfterTransformation,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    dependencies: htmlDependencies.map(({ specifier }) => {
      return specifier
    }),
  }
}

// transform <link type="modulepreload"> into <link type="preload">
// also remove integrity attributes because we don't know in advance
// the result of the file compilation
const visitRessourceHints = async ({ ressourceHints, addHtmlMutation }) => {
  await Promise.all(
    ressourceHints.map(async (ressourceHint) => {
      const hrefAttribute = getHtmlNodeAttributeByName(ressourceHint, "href")
      const href = hrefAttribute ? hrefAttribute.value : ""
      if (!href) {
        return
      }
      const integrityAttribute = getHtmlNodeAttributeByName(
        ressourceHint,
        "integrity",
      )
      if (integrityAttribute) {
        addHtmlMutation(() => {
          removeHtmlNodeAttribute(ressourceHint, integrityAttribute)
        })
      }
      const relAttribute = getHtmlNodeAttributeByName(ressourceHint, "rel")
      const asAttribute = getHtmlNodeAttributeByName(ressourceHint, "as")
      // - "modulepreload" -> "preload" because it's now regular js script
      if (ressourceHint.rel === "modulepreload") {
        addHtmlMutation(() => {
          relAttribute.value = "preload"
          if (asAttribute) {
            asAttribute.value = "script"
          } else {
            addHtmlNodeAttribute(ressourceHint, { name: "as", value: "script" })
          }
        })
        return
      }
      // if (asAttribute && asAttribute.value === "script") {
      //   addHtmlMutation(() => {
      //     replaceHtmlNode(htmlNode, `<link as="script" />`)
      //   })
      //   return
      // }
    }),
  )
}

const visitImportmapScript = async ({
  htmlAst,
  logger,
  url,
  compiledUrl,
  projectDirectoryUrl,
  compileDirectoryUrl,
  moduleOutFormat,
  scripts,
  addHtmlMutation,
  addHtmlSourceFile,
  onHtmlImportmapInfo,
}) => {
  const importmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    return type === "importmap"
  })
  // in case there is no importmap, force the presence
  // so that '@jsenv/core/' are still remapped
  if (importmapScripts.length === 0) {
    const defaultImportMap = getDefaultImportmap(compiledUrl, {
      projectDirectoryUrl,
      compileDirectoryUrl,
    })
    const defaultImportMapAsText = JSON.stringify(defaultImportMap, null, "  ")
    onHtmlImportmapInfo({
      url: compiledUrl,
      text: defaultImportMapAsText,
    })
    addHtmlMutation(() => {
      manipulateHtmlAst(htmlAst, {
        scriptInjections: [
          {
            type:
              moduleOutFormat === "systemjs"
                ? "systemjs-importmap"
                : "importmap",
            text: defaultImportMapAsText,
          },
        ],
      })
    })
    return
  }
  if (importmapScripts.length > 1) {
    logger.error("HTML file must contain max 1 importmap")
  }
  const firstImportmapScript = importmapScripts[0]
  const srcAttribute = getHtmlNodeAttributeByName(firstImportmapScript, "src")
  const src = srcAttribute ? srcAttribute.value : ""
  if (src) {
    const importmapUrl = resolveUrl(src, url)
    const importMapResponse = await fetchUrl(importmapUrl)
    let importmap
    if (importMapResponse.status === 200) {
      const importmapAsText = await importMapResponse.text()
      addHtmlSourceFile({
        url: importmapUrl,
        content: importmapAsText,
      })
      let htmlImportmap = JSON.parse(importmapAsText)
      importmap = moveImportMap(htmlImportmap, importmapUrl, url)
    } else {
      logger.warn(
        createDetailedMessage(
          importMapResponse.status === 404
            ? `importmap script file cannot be found.`
            : `importmap script file unexpected response status (${importMapResponse.status}).`,
          {
            "importmap url": importmapUrl,
            "html url": url,
          },
        ),
      )
      importmap = {}
    }
    const importmapAsText = JSON.stringify(importmap, null, "  ")
    onHtmlImportmapInfo({
      url: importmapUrl,
      text: importmapAsText,
    })
    addHtmlMutation(() => {
      removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
      setHtmlNodeText(firstImportmapScript, importmapAsText)
      if (moduleOutFormat === "systemjs") {
        const typeAttribute = getHtmlNodeAttributeByName(
          firstImportmapScript,
          "type",
        )
        typeAttribute.value = "systemjs-importmap"
      }
    })
    return
  }

  const jsenvImportmap = getDefaultImportmap(compiledUrl, {
    projectDirectoryUrl,
    compileDirectoryUrl,
  })
  const htmlImportmap = JSON.parse(
    getHtmlNodeTextNode(firstImportmapScript).value,
  )
  const importmap = composeTwoImportMaps(jsenvImportmap, htmlImportmap)
  const importmapAsText = JSON.stringify(importmap, null, "  ")
  onHtmlImportmapInfo({
    url: compiledUrl,
    text: importmapAsText,
  })
  addHtmlMutation(() => {
    removeHtmlNodeAttribute(firstImportmapScript, srcAttribute)
    setHtmlNodeText(firstImportmapScript, importmapAsText)
    if (moduleOutFormat === "systemjs") {
      const typeAttribute = getHtmlNodeAttributeByName(
        firstImportmapScript,
        "type",
      )
      typeAttribute.value = "systemjs-importmap"
    }
  })
  return
}

const visitScripts = async ({
  logger,
  projectDirectoryUrl,
  compileServerOrigin,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,
  sourcemapMethod,

  scripts,
  addHtmlSourceFile,
  addHtmlAssetGenerator,
  addHtmlMutation,
  addHtmlDependency,
}) => {
  scripts.forEach((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const type = typeAttribute ? typeAttribute.value : "application/javascript"
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    const integrityAttribute = getHtmlNodeAttributeByName(script, "integrity")
    const textNode = getHtmlNodeTextNode(script)
    if (type === "module") {
      if (src) {
        addHtmlMutation(() => {
          if (moduleOutFormat === "systemjs") {
            removeHtmlNodeAttribute(script, typeAttribute)
          }
          if (integrityAttribute) {
            removeHtmlNodeAttribute(script, integrityAttribute)
          }
          removeHtmlNodeAttribute(script, srcAttribute)
          const jsenvMethod =
            moduleOutFormat === "systemjs"
              ? "executeFileUsingSystemJs"
              : "executeFileUsingDynamicImport"
          let specifier
          if (
            jsenvRemoteDirectory.isRemoteUrl(src) &&
            !jsenvRemoteDirectory.isPreservedUrl(src)
          ) {
            const fileUrl = jsenvRemoteDirectory.fileUrlFromRemoteUrl(src)
            const fileUrlRelativeToHtml = urlToRelativeUrl(fileUrl, url)
            specifier = `./${fileUrlRelativeToHtml}`
          } else {
            specifier = src
          }
          setHtmlNodeText(
            script,
            `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
          )
        })
        return
      }
      const scriptId = getIdForInlineHtmlNode(script, scripts)
      const inlineScriptName = `${scriptId}.js`
      const scriptOriginalUrl = resolveUrl(inlineScriptName, url)
      const scriptCompiledUrl = generateCompilationAssetUrl(
        compiledUrl,
        inlineScriptName,
      )
      addHtmlAssetGenerator(async () => {
        return transformHtmlScript({
          projectDirectoryUrl,
          jsenvRemoteDirectory,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,

          type: "module",
          babelPluginMap,
          moduleOutFormat,
          importMetaFormat,
          topLevelAwait,

          sourcemapMethod,
          code: textNode.value,
        })
      })
      const specifier = `./${urlToRelativeUrl(scriptCompiledUrl, compiledUrl)}`
      addHtmlMutation(() => {
        if (moduleOutFormat === "systemjs") {
          removeHtmlNodeAttribute(script, typeAttribute)
        }
        removeHtmlNodeAttribute(script, srcAttribute)
        const jsenvMethod =
          moduleOutFormat === "systemjs"
            ? "executeFileUsingSystemJs"
            : "executeFileUsingDynamicImport"
        setHtmlNodeText(
          script,
          `window.__jsenv__.${jsenvMethod}(${JSON.stringify(specifier)})`,
        )
      })
      addHtmlDependency({
        htmlNode: script,
        specifier,
      })
      return
    }
    if (type === "application/javascript" || type === "text/javascript") {
      if (src) {
        const htmlServerUrl = url.replace(
          projectDirectoryUrl,
          `${compileServerOrigin}/`,
        )
        const scriptOriginalServerUrl = resolveUrl(src, htmlServerUrl)
        const scriptOriginalUrl = scriptOriginalServerUrl.replace(
          `${compileServerOrigin}/`,
          projectDirectoryUrl,
        )
        const fileIsInsideJsenvDistDirectory = urlIsInsideOf(
          scriptOriginalUrl,
          jsenvDistDirectoryUrl,
        )
        if (fileIsInsideJsenvDistDirectory) {
          return
        }
        const isRemoteUrl = jsenvRemoteDirectory.isRemoteUrl(src)
        if (isRemoteUrl && jsenvRemoteDirectory.isPreservedUrl(src)) {
          return
        }
        const scriptCompiledUrl = generateCompilationAssetUrl(
          compiledUrl,
          urlToFilename(scriptOriginalUrl),
        )
        addHtmlAssetGenerator(async () => {
          // we fetch scriptOriginalUrl on purpose because we do
          // the transformation here and not in compile server
          // (because compile server would think it's a module script
          // and add things like systemjs)
          // we could take into account the integrity her
          const scriptResponse = await fetchUrl(scriptOriginalUrl)
          if (scriptResponse.status !== 200) {
            logger.warn(
              createDetailedMessage(
                scriptResponse.status === 404
                  ? `script file cannot be found.`
                  : `script file unexpected response status (${scriptResponse.status}).`,
                {
                  "script url": script.url,
                  "html url": url,
                },
              ),
            )
            return []
          }
          const scriptAsText = await scriptResponse.text()
          addHtmlSourceFile({
            url: scriptOriginalUrl,
            content: scriptAsText,
          })
          return transformHtmlScript({
            projectDirectoryUrl,
            jsenvRemoteDirectory,
            url: scriptOriginalUrl,
            compiledUrl: scriptCompiledUrl,

            type: "classic",
            babelPluginMap,
            moduleOutFormat,
            importMetaFormat,
            topLevelAwait,

            sourcemapMethod,
            code: scriptAsText,
          })
        })
        addHtmlMutation(() => {
          if (integrityAttribute) {
            removeHtmlNodeAttribute(script, integrityAttribute)
          }
          srcAttribute.value = `./${urlToRelativeUrl(
            scriptCompiledUrl,
            compiledUrl,
          )}`
        })
        return
      }
      const scriptId = getIdForInlineHtmlNode(script, scripts)
      const inlineScriptName = `${scriptId}.js`
      const scriptOriginalUrl = resolveUrl(inlineScriptName, url)
      const scriptCompiledUrl = generateCompilationAssetUrl(
        compiledUrl,
        inlineScriptName,
      )
      addHtmlAssetGenerator(async () => {
        const htmlAssets = await transformHtmlScript({
          projectDirectoryUrl,
          jsenvRemoteDirectory,
          url: scriptOriginalUrl,
          compiledUrl: scriptCompiledUrl,

          type: "classic",
          babelPluginMap,
          moduleOutFormat,
          importMetaFormat,
          topLevelAwait,

          code: textNode.value,
          sourcemapMethod,
        })
        addHtmlMutation(() => {
          setHtmlNodeText(script, htmlAssets[0].content)
        })
        return htmlAssets
      })
      return
    }
  })
}

const transformHtmlScript = async ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,
  compiledUrl,

  type,
  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  topLevelAwait,

  code,
  sourcemapMethod,
}) => {
  let transformResult
  try {
    transformResult = await transformJs({
      projectDirectoryUrl,
      jsenvRemoteDirectory,
      url,
      compiledUrl,

      babelPluginMap,
      moduleOutFormat: type === "module" ? moduleOutFormat : "global",
      importMetaFormat,
      topLevelAwait: type === "module" ? topLevelAwait : false,
      babelHelpersInjectionAsImport: type === "module" ? undefined : false,

      code,
    })
  } catch (e) {
    // If there is a syntax error in inline script
    // we put the raw script without transformation.
    // when systemjs will try to instantiate to script it
    // will re-throw this syntax error.
    // Thanks to this we see the syntax error in the
    // document and livereloading still works
    // because we gracefully handle this error
    if (e.code === "PARSE_ERROR") {
      return [{ url, content: code }]
    }
    throw e
  }

  code = transformResult.code
  let map = transformResult.map
  const sourcemapUrl = generateSourcemapUrl(compiledUrl)
  if (sourcemapMethod === "inline") {
    code = setJavaScriptSourceMappingUrl(code, sourcemapToBase64Url(map))
    return [
      {
        url: compiledUrl,
        content: code,
      },
    ]
  }
  const sourcemapSpecifier = urlToRelativeUrl(sourcemapUrl, compiledUrl)
  code = setJavaScriptSourceMappingUrl(code, sourcemapSpecifier)
  return [
    {
      url: compiledUrl,
      content: code,
    },
    {
      url: sourcemapUrl,
      content: JSON.stringify(map, null, "  "),
    },
  ]
}

const collectRessourceHints = (htmlAst) => {
  const ressourceHints = []
  visitHtmlAst(htmlAst, (htmlNode) => {
    if (htmlNode.nodeName !== "link") {
      return
    }
    const relAttribute = getHtmlNodeAttributeByName(htmlNode, "rel")
    const rel = relAttribute ? relAttribute.value : ""
    const isRessourceHint = [
      "preconnect",
      "dns-prefetch",
      "prefetch",
      "preload",
      "modulepreload",
    ].includes(rel)
    if (!isRessourceHint) {
      return
    }
    ressourceHints.push(htmlNode)
  })
  return ressourceHints
}
