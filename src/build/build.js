/*
 *
 */

import {
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
  urlIsInsideOf,
  urlToBasename,
  urlToExtension,
  urlToRelativeUrl,
  writeFile,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import {
  injectQueryParams,
  setUrlFilename,
} from "@jsenv/core/src/utils/url_utils.js"
import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { loadUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph_load.js"
import { createTaskLog } from "@jsenv/core/src/utils/logs/task_log.js"
import { createUrlGraphSummary } from "@jsenv/core/src/utils/url_graph/url_graph_report.js"
import { sortUrlGraphByDependencies } from "@jsenv/core/src/utils/url_graph/url_graph_sort.js"
import { createUrlVersionGenerator } from "@jsenv/core/src/utils/url_version_generator.js"
import { jsenvPluginInline } from "@jsenv/core/src/omega/plugins/inline/jsenv_plugin_inline.js"

import { applyLeadingSlashUrlResolution } from "../omega/kitchen/leading_slash_url_resolution.js"
import { getJsenvPlugins } from "../omega/jsenv_plugins.js"

import { createKitchen } from "../omega/kitchen/kitchen.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { buildWithRollup } from "./build_with_rollup.js"
import { injectVersionMappings } from "./inject_version_mappings.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
} from "../utils/html_ast/html_ast.js"

export const build = async ({
  signal = new AbortController().signal,
  logLevel = "info",
  rootDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  // for now it's here but I think preview will become an other script
  // that will just pass different options to build project
  // and this function will be agnostic about "preview" concept
  isPreview = false,
  plugins = [],
  runtimeSupport = {
    android: "0.0.0",
    chrome: "0.0.0",
    edge: "0.0.0",
    electron: "0.0.0",
    firefox: "0.0.0",
    ios: "0.0.0",
    opera: "0.0.0",
    rhino: "0.0.0",
    safari: "0.0.0",
  },
  sourcemapMethod = isPreview ? "file" : false,

  bundling = true,
  versioning = true,
  versioningMethod = "filename", // "search_param", "filename"
  lineBreakNormalization = process.platform === "win32",

  writeOnFileSystem = true,
  buildDirectoryClean = true,
  baseUrl = "/",
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const rawGraph = createUrlGraph()
  const loadRawGraphLog = createTaskLog("load files")
  let urlCount = 0
  const rawGraphKitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph: rawGraph,
    sourcemapMethod,
    plugins: [
      ...plugins,
      {
        name: "jsenv:build_log",
        appliesDuring: { build: true },
        cooked: () => {
          urlCount++
          loadRawGraphLog.setRightText(urlCount)
        },
      },
      ...getJsenvPlugins({
        baseUrl,
      }),
    ],
    scenario: "build",
  })
  const loadEntryFiles = (cookEntryFile) => {
    Object.keys(entryPoints).forEach((key) => {
      cookEntryFile({
        trace: `"${key}" in entryPoints parameter`,
        type: "entry_point",
        specifier: key,
      })
    })
  }
  try {
    await loadUrlGraph({
      urlGraph: rawGraph,
      kitchen: rawGraphKitchen,
      outDirectoryUrl: new URL(`.jsenv/build/`, rootDirectoryUrl),
      runtimeSupport,
      startLoading: loadEntryFiles,
    })
  } catch (e) {
    loadRawGraphLog.fail()
    throw e
  }
  // here we can perform many checks such as ensuring ressource hints are used
  loadRawGraphLog.done()
  logger.info(createUrlGraphSummary(rawGraph, { title: "raw build files" }))
  logger.debug(
    `raw graph urls:
${Object.keys(rawGraph.urlInfos).join("\n")}`,
  )

  const buildUrlInfos = {}
  if (bundling) {
    const jsModulesUrlsToBundle = []
    const cssUrlsToBundle = []
    Object.keys(rawGraph.urlInfos).forEach((sourceUrl) => {
      const sourceUrlInfo = rawGraph.getUrlInfo(sourceUrl)
      if (!sourceUrlInfo.data.isEntryPoint) {
        return
      }
      if (sourceUrlInfo.type === "html") {
        sourceUrlInfo.dependencies.forEach((dependencyUrl) => {
          const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl)
          if (dependencyUrlInfo.type === "js_module") {
            if (dependencyUrlInfo.inlineUrlSite) {
              // on veut bundle les deps de ce code inline
              dependencyUrlInfo.references.forEach((inlineScriptRef) => {
                if (inlineScriptRef.type === "js_import_export") {
                  jsModulesUrlsToBundle.push(inlineScriptRef.url)
                }
              })
              return
            }
            jsModulesUrlsToBundle.push(dependencyUrl)
            return
          }
          if (dependencyUrlInfo.type === "css") {
            cssUrlsToBundle.push(dependencyUrl)
            return
          }
        })
        return
      }
      if (sourceUrlInfo.type === "js_module") {
        jsModulesUrlsToBundle.push(sourceUrlInfo.url)
        return
      }
      if (sourceUrlInfo.type === "css") {
        cssUrlsToBundle.push(sourceUrlInfo.url)
        return
      }
    })
    // in the future this should be done in a "bundle" hook
    if (jsModulesUrlsToBundle.length) {
      const rollupBuildLog = createTaskLog(`bundle js modules with rollup`)
      try {
        const rollupBuild = await buildWithRollup({
          signal,
          logger,
          rootDirectoryUrl,
          buildDirectoryUrl,
          rawGraph,
          jsModulesUrlsToBundle,

          runtimeSupport,
          sourcemapMethod,
        })
        const { jsModuleInfos } = rollupBuild
        Object.keys(jsModuleInfos).forEach((url) => {
          const jsModuleInfo = jsModuleInfos[url]
          buildUrlInfos[url] = {
            data: jsModuleInfo.data,
            type: "js_module",
            contentType: "application/javascript",
            content: jsModuleInfo.content,
            sourcemap: jsModuleInfo.sourcemap,
          }
        })
      } catch (e) {
        rollupBuildLog.fail()
        throw e
      }
      rollupBuildLog.done()
    }
    if (cssUrlsToBundle.length) {
      // on pourrait concat + minify en utilisant post css
    }
  }
  // TODO: minify html, svg, json
  // in the future this should be done in a "optimize" hook

  const buildUrlsGenerator = createBuilUrlsGenerator({
    buildDirectoryUrl,
  })
  const sourceUrls = {}
  const buildSpecifiers = {}
  const finalGraph = createUrlGraph()
  const finalGraphKitchen = createKitchen({
    rootDirectoryUrl,
    urlGraph: finalGraph,
    plugins: [
      jsenvPluginInline(),
      {
        name: "jsenv:postbuild",
        appliesDuring: { build: true },
        resolve: ({ parentUrl, specifier, isInline }) => {
          if (isInline) {
            const parentUrlInfo = finalGraph.getUrlInfo(parentUrl)
            const parentSourceUrl = parentUrlInfo.data.sourceUrl
            return new URL(specifier, parentSourceUrl).href
          }
          return (
            applyLeadingSlashUrlResolution(specifier, rootDirectoryUrl) ||
            new URL(specifier, parentUrl).href
          )
        },
        normalize: ({ url, data }) => {
          // already a build url
          const sourceUrl = sourceUrls[url]
          if (sourceUrl) {
            data.sourceUrl = sourceUrl
            return url
          }
          const buildUrlInfo = buildUrlInfos[url]
          // from rollup or postcss
          if (buildUrlInfo) {
            const buildUrl = buildUrlsGenerator.generate(
              url,
              buildUrlInfo.data.isEntryPoint ||
                buildUrlInfo.type === "js_module"
                ? "/"
                : "assets/",
            )
            data.sourceUrl = url
            sourceUrls[buildUrl] = url
            return buildUrl
          }
          const rawUrlInfo = rawGraph.getUrlInfo(url)
          // files from root directory but not given to rollup not postcss
          if (rawUrlInfo) {
            const buildUrl = buildUrlsGenerator.generate(
              url,
              rawUrlInfo.data.isEntryPoint || rawUrlInfo.type === "js_module"
                ? "/"
                : "assets/",
            )
            data.sourceUrl = url
            sourceUrls[buildUrl] = url
            return buildUrl
          }
          // files generated during the final graph (sourcemaps)
          // const finalUrlInfo = finalGraph.getUrlInfo(url)
          const buildUrl = buildUrlsGenerator.generate(url, "assets/")
          return buildUrl
        },
        formatReferencedUrl: ({ url }) => {
          if (!url.startsWith("file:")) {
            return null
          }
          if (!urlIsInsideOf(url, buildDirectoryUrl)) {
            throw new Error(
              `file url should be inside build directory at this stage`,
            )
          }
          const specifier = `${baseUrl}${urlToRelativeUrl(
            url,
            buildDirectoryUrl,
          )}`
          buildSpecifiers[url] = specifier
          return specifier
        },
        load: ({ data }) => {
          const sourceUrl = data.sourceUrl
          const urlInfo =
            buildUrlInfos[sourceUrl] || rawGraph.getUrlInfo(sourceUrl)
          return {
            contentType: urlInfo.contentType,
            content: urlInfo.content,
            sourcemap: urlInfo.sourcemap,
          }
        },
        transform: {
          html: ({ content }) => {
            const htmlAst = parseHtmlString(content)
            return {
              content: stringifyHtmlAst(htmlAst, {
                // we'll see that later
                // removeOriginalPositionAttributes: true,
              }),
            }
          },
        },
      },
    ],
    scenario: "build",
  })
  const loadFinalGraphLog = createTaskLog("generating build files")
  try {
    await loadUrlGraph({
      urlGraph: finalGraph,
      kitchen: finalGraphKitchen,
      outDirectoryUrl: new URL(".jsenv/postbuild/", rootDirectoryUrl),
      startLoading: loadEntryFiles,
    })
  } catch (e) {
    loadFinalGraphLog.fail()
    throw e
  }
  loadFinalGraphLog.done()

  logger.debug(
    `graph urls pre-versioning:
${Object.keys(finalGraph.urlInfos).join("\n")}`,
  )
  if (versioning) {
    const urlVersioningLog = createTaskLog("inject version in urls")
    try {
      const urlsSorted = sortUrlGraphByDependencies(finalGraph)
      urlsSorted.forEach((url) => {
        const urlInfo = finalGraph.getUrlInfo(url)
        const urlVersionGenerator = createUrlVersionGenerator()
        urlVersionGenerator.augmentWithContent({
          content: urlInfo.content,
          contentType: urlInfo.contentType,
          lineBreakNormalization,
        })
        urlInfo.dependencies.forEach((dependencyUrl) => {
          const dependencyUrlInfo = finalGraph.getUrlInfo(dependencyUrl)
          if (dependencyUrlInfo.data.version) {
            urlVersionGenerator.augmentWithDependencyVersion(
              dependencyUrlInfo.data.version,
            )
          } else {
            // because all dependencies are know, if the dependency has no version
            // it means there is a circular dependency between this file
            // and it's dependency
            // in that case we'll use the dependency content
            urlVersionGenerator.augmentWithContent({
              content: dependencyUrlInfo.content,
              contentType: dependencyUrlInfo.contentType,
              lineBreakNormalization,
            })
          }
        })
        urlInfo.data.version = urlVersionGenerator.generate()
        urlInfo.data.versionedUrl = injectVersionIntoBuildUrl({
          buildUrl: urlInfo.url,
          version: urlInfo.data.version,
          versioningMethod,
        })
      })
      const versionMappings = {}
      const versioningKitchen = createKitchen({
        rootDirectoryUrl: buildDirectoryUrl,
        urlGraph: finalGraph,
        plugins: [
          jsenvPluginInline(),
          {
            name: "jsenv:versioning",
            appliesDuring: { build: true },
            resolve: ({ parentUrl, specifier }) => {
              const url =
                applyLeadingSlashUrlResolution(specifier, buildDirectoryUrl) ||
                new URL(specifier, parentUrl).href
              return url
            },
            formatReferencedUrl: ({ url, type, subtype, isInline }) => {
              if (isInline) {
                return null
              }
              // specifier comes from "normalize" hook done a bit earlier in this file
              // we want to get back their build url to access their infos
              const buildSpecifier = buildSpecifiers[url]
              if (!buildSpecifier) {
                // There is not build mapping for the specifier
                // if the specifier was not normalized
                // happens for https://*, http://* , data:*
                return null
              }
              const referencedUrlInfo = finalGraph.getUrlInfo(url)
              if (referencedUrlInfo.data.isEntryPoint) {
                return buildSpecifier
              }
              const versionedSpecifier = `${baseUrl}${urlToRelativeUrl(
                referencedUrlInfo.data.versionedUrl,
                buildDirectoryUrl,
              )}`
              versionMappings[buildSpecifier] = versionedSpecifier
              if (
                type === "js_import_meta_url_pattern" ||
                subtype === "import_dynamic"
              ) {
                return () =>
                  `window.__asVersionedSpecifier__(${JSON.stringify(
                    buildSpecifier,
                  )})`
              }
              return versionedSpecifier
            },
            load: ({ url }) => {
              const urlInfo = finalGraph.getUrlInfo(url)
              return {
                contentType: urlInfo.contentType,
                content: urlInfo.content,
                sourcemap: urlInfo.sourcemap,
              }
            },
          },
        ],
        scenario: "build",
      })
      // arrange state before reloading all files
      Object.keys(finalGraph.urlInfos).forEach((url) => {
        const urlInfo = finalGraph.urlInfos[url]
        urlInfo.data.promise = null
        urlInfo.originalContent = urlInfo.content
      })
      await loadUrlGraph({
        urlGraph: finalGraph,
        kitchen: versioningKitchen,
        startLoading: loadEntryFiles,
      })
      if (Object.keys(versionMappings).length) {
        Object.keys(finalGraph.urlInfos).forEach((buildUrl) => {
          const buildUrlInfo = finalGraph.getUrlInfo(buildUrl)
          if (!buildUrlInfo.data.isEntryPoint) {
            return
          }
          injectVersionMappings(buildUrlInfo, {
            versionMappings,
            sourcemapMethod,
          })
        })
      }
    } catch (e) {
      urlVersioningLog.fail()
      throw e
    }
    urlVersioningLog.done()
  }

  const buildFileContents = {}
  const buildInlineFileContents = {}
  const buildManifest = {}
  Object.keys(finalGraph.urlInfos).forEach((url) => {
    const buildUrlInfo = finalGraph.getUrlInfo(url)
    const buildUrl = buildUrlInfo.data.versionedUrl || buildUrlInfo.url
    if (!urlIsInsideOf(buildUrl, buildDirectoryUrl)) {
      throw new Error(`build url outside build directory`)
    }
    const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl)
    if (buildUrlInfo.inlineUrlSite) {
      buildInlineFileContents[buildRelativeUrl] = buildUrlInfo.content
    } else {
      buildFileContents[buildRelativeUrl] = buildUrlInfo.content
    }
    if (buildUrlInfo.data.versionedUrl) {
      const buildRelativeUrlWithoutVersioning = urlToRelativeUrl(
        buildUrlInfo.url,
        buildDirectoryUrl,
      )
      buildManifest[buildRelativeUrlWithoutVersioning] = buildRelativeUrl
    }
  })
  if (writeOnFileSystem) {
    if (buildDirectoryClean) {
      await ensureEmptyDirectory(buildDirectoryUrl)
    }
    const buildRelativeUrls = Object.keys(buildFileContents)
    await Promise.all(
      buildRelativeUrls.map(async (buildRelativeUrl) => {
        await writeFile(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        )
      }),
    )
  }
  logger.info(createUrlGraphSummary(finalGraph, { title: "build files" }))
  return {
    buildFileContents,
    buildInlineFileContents,
    buildManifest,
  }
}

const injectVersionIntoBuildUrl = ({ buildUrl, version, versioningMethod }) => {
  if (versioningMethod === "search_param") {
    return injectQueryParams(buildUrl, {
      v: version,
    })
  }
  const basename = urlToBasename(buildUrl)
  const extension = urlToExtension(buildUrl)
  const versionedFilename = `${basename}-${version}${extension}`
  const versionedUrl = setUrlFilename(buildUrl, versionedFilename)
  return versionedUrl
}

const assertEntryPoints = ({ entryPoints }) => {
  if (typeof entryPoints !== "object" || entryPoints === null) {
    throw new TypeError(`entryPoints must be an object, got ${entryPoints}`)
  }
  const keys = Object.keys(entryPoints)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPoints, all keys must start with ./ but found ${key}`,
      )
    }
    const value = entryPoints[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (value.includes("/")) {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be plain strings (no "/") but found ${value} for key ${key}`,
      )
    }
  })
}
