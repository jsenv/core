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
  injectQueryParamsIntoSpecifier,
  setUrlFilename,
  isValidUrl,
} from "@jsenv/core/src/utils/url_utils.js"
import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { loadUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph_load.js"
import { createTaskLog } from "@jsenv/core/src/utils/logs/task_log.js"
import { createUrlGraphSummary } from "@jsenv/core/src/utils/url_graph/url_graph_report.js"
import { sortUrlGraphByDependencies } from "@jsenv/core/src/utils/url_graph/url_graph_sort.js"
import { createUrlVersionGenerator } from "@jsenv/core/src/utils/url_version_generator.js"
import { generateSourcemapUrl } from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"

import { applyLeadingSlashUrlResolution } from "../omega/kitchen/leading_slash_url_resolution.js"
import { createPluginController } from "../omega/kitchen/plugin_controller.js"
import { getJsenvPlugins } from "../omega/jsenv_plugins.js"

import { createKitchen } from "../omega/kitchen/kitchen.js"
import { parseUrlMentions } from "../omega/url_mentions/parse_url_mentions.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { buildWithRollup } from "./build_with_rollup.js"
import { updateContentAndSourcemap } from "./update_content_and_sourcemap.js"
import { injectVersionMapping } from "./inject_version_mapping.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
} from "../utils/html_ast/html_ast.js"

export const generateBuild = async ({
  signal = new AbortController().signal,
  logLevel = "info",
  sourceDirectoryUrl,
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

  versioning = true,
  versioningMethod = "filename", // "search_param", "filename"
  lineBreakNormalization = process.platform === "win32",

  writeOnFileSystem = true,
  buildDirectoryClean = true,
  baseUrl = "/",
}) => {
  const logger = createLogger({ logLevel })
  sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(sourceDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const sourceGraph = createUrlGraph({
    rootDirectoryUrl: sourceDirectoryUrl,
  })
  const loadSourceGraphLog = createTaskLog("load source graph")
  let urlCount = 0
  const sourcePluginController = createPluginController({
    plugins: [
      ...plugins,
      {
        name: "jsenv:build_log",
        appliesDuring: { build: true },
        cooked: () => {
          urlCount++
          loadSourceGraphLog.setRightText(urlCount)
        },
      },
      ...getJsenvPlugins(),
    ],
    scenario: "build",
  })
  const sourceKitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl: sourceDirectoryUrl,
    pluginController: sourcePluginController,
    urlGraph: sourceGraph,
    sourcemapMethod,
    scenario: "build",
    baseUrl,
  })
  try {
    await loadUrlGraph({
      urlGraph: sourceGraph,
      kitchen: sourceKitchen,
      outDirectoryUrl: new URL(`.jsenv/build/`, sourceDirectoryUrl),
      runtimeSupport,
      startLoading: (cook) => {
        Object.keys(entryPoints).forEach((key) => {
          const sourceEntryReference = sourceKitchen.createReference({
            trace: `"${key}" in entryPoints parameter`,
            parentUrl: sourceDirectoryUrl,
            type: "entry_point",
            specifier: key,
          })
          const sourcEntryUrlInfo =
            sourceKitchen.resolveReference(sourceEntryReference)
          sourcEntryUrlInfo.data.isEntryPoint = true
          cook({
            reference: sourceEntryReference,
            urlInfo: sourcEntryUrlInfo,
          })
        })
      },
    })
  } catch (e) {
    loadSourceGraphLog.fail()
    throw e
  }
  // here we can perform many checks such as ensuring ressource hints are used
  loadSourceGraphLog.done()
  logger.info(createUrlGraphSummary(sourceGraph, { title: "source files" }))

  const jsModulesUrlsToBuild = []
  const cssUrlsToBuild = []
  Object.keys(sourceGraph.urlInfos).forEach((sourceUrl) => {
    const sourceUrlInfo = sourceGraph.getUrlInfo(sourceUrl)
    if (!sourceUrlInfo.data.isEntryPoint) {
      return
    }
    if (sourceUrlInfo.type === "html") {
      sourceUrlInfo.dependencies.forEach((dependencyUrl) => {
        const dependencyUrlInfo = sourceGraph.getUrlInfo(dependencyUrl)
        if (dependencyUrlInfo.type === "js_module") {
          jsModulesUrlsToBuild.push(dependencyUrl)
          return
        }
        if (dependencyUrlInfo.type === "css") {
          cssUrlsToBuild.push(dependencyUrl)
          return
        }
      })
      return
    }
    if (sourceUrlInfo.type === "js_module") {
      jsModulesUrlsToBuild.push(sourceUrlInfo.url)
      return
    }
    if (sourceUrlInfo.type === "css") {
      cssUrlsToBuild.push(sourceUrlInfo.url)
      return
    }
  })

  const buildUrlInfos = {}
  // in the future this should be done in a "bundle" hook
  if (jsModulesUrlsToBuild.length) {
    const rollupBuildLog = createTaskLog(`building js modules with rollup`)
    try {
      const rollupBuild = await buildWithRollup({
        signal,
        logger,
        sourceDirectoryUrl,
        buildDirectoryUrl,
        sourceGraph,
        jsModulesUrlsToBuild,

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
  if (cssUrlsToBuild.length) {
    // on pourrait concat + minify en utilisant post css
  }
  // TODO: minify html, svg, json
  // in the future this should be done in a "optimize" hook

  const buildUrlsGenerator = createBuilUrlsGenerator({
    buildDirectoryUrl,
  })
  const buildUrlMappings = {}
  const buildPluginController = createPluginController({
    injectJsenvPlugins: false,
    plugins: [
      {
        name: "jsenv:postbuild",
        appliesDuring: { postbuild: true },
        resolve: ({ parentUrl, specifier }) => {
          return (
            applyLeadingSlashUrlResolution(specifier, sourceDirectoryUrl) ||
            new URL(specifier, parentUrl).href
          )
        },
        normalize: ({ url, data }) => {
          const urlInfo = buildUrlInfos[url] || sourceGraph.getUrlInfo(url)
          const buildUrl = buildUrlsGenerator.generate(
            url,
            urlInfo.data.isEntryPoint || urlInfo.type === "js_module"
              ? "/"
              : "assets/",
          )
          data.sourceUrl = url
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
          buildUrlMappings[specifier] = url
          return specifier
        },
        load: ({ data }) => {
          const sourceUrl = data.sourceUrl
          const urlInfo =
            buildUrlInfos[sourceUrl] || sourceGraph.getUrlInfo(sourceUrl)
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
                removeOriginalPositionAttributes: true,
              }),
            }
          },
        },
      },
    ],
    scenario: "postbuild",
  })
  const buildGraph = createUrlGraph({
    rootDirectoryUrl: buildDirectoryUrl,
  })
  const buildKitchen = createKitchen({
    rootDirectoryUrl: sourceDirectoryUrl,
    urlGraph: buildGraph,
    pluginController: buildPluginController,
    scenario: "postbuild",

    baseUrl,
  })
  const loadBuilGraphLog = createTaskLog("load build graph")
  try {
    await loadUrlGraph({
      urlGraph: buildGraph,
      kitchen: buildKitchen,
      outDirectoryUrl: new URL(".jsenv/build/", sourceDirectoryUrl),
      startLoading: (cook) => {
        Object.keys(entryPoints).forEach((key) => {
          const buildEntryReference = buildKitchen.createReference({
            trace: `"${key}" in entryPoints parameter`,
            parentUrl: sourceDirectoryUrl,
            type: "entry_point",
            specifier: key,
          })
          const buildEntryUrlInfo =
            buildKitchen.resolveReference(buildEntryReference)
          buildEntryUrlInfo.data.isEntryPoint = true
          cook({
            reference: buildEntryReference,
            urlInfo: buildEntryUrlInfo,
          })
        })
      },
    })
  } catch (e) {
    loadBuilGraphLog.fail()
    throw e
  }
  loadBuilGraphLog.done()

  if (versioning) {
    const urlVersioningLog = createTaskLog("inject version in urls")
    try {
      const urlsSorted = sortUrlGraphByDependencies(buildGraph)
      urlsSorted.forEach((url) => {
        const urlInfo = buildGraph.getUrlInfo(url)
        const urlVersionGenerator = createUrlVersionGenerator()
        urlVersionGenerator.augmentWithContent({
          content: urlInfo.content,
          contentType: urlInfo.contentType,
          lineBreakNormalization,
        })
        urlInfo.dependencies.forEach((dependencyUrl) => {
          const dependencyUrlInfo = buildGraph.getUrlInfo(dependencyUrl)
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
      })
      const versionMappings = {}
      await Promise.all(
        urlsSorted.map(async (url) => {
          const urlInfo = buildGraph.getUrlInfo(url)
          const parseResult = await parseUrlMentions({
            url: urlInfo.url,
            type: urlInfo.type,
            content: urlInfo.content,
            scenario: "build",
          })
          if (parseResult) {
            const { replaceUrls } = parseResult
            const { content, sourcemap } = await replaceUrls((urlMention) => {
              // specifier comes from "normalize" hook done a bit earlier in this file
              // we want to get back their build url to access their infos
              const buildUrl = buildUrlMappings[urlMention.specifier]
              if (!buildUrl) {
                // There is not build mapping for the specifier
                // if the specifier was not normalized
                // happens for https://*, http://* , data:*
                return null
              }
              const urlInfo = buildGraph.getUrlInfo(buildUrl)
              if (urlInfo.data.isEntryPoint) {
                return null
              }
              const versionedSpecifier = injectVersionIntoSpecifier({
                versioningMethod,
                specifier: urlMention.specifier,
                version: urlInfo.data.version,
              })
              versionMappings[urlMention.specifier] = versionedSpecifier
              if (
                urlMention.type === "js_import_meta_url_pattern" ||
                urlMention.subtype === "import_dynamic"
              ) {
                return `window.__asVersionedSpecifier__(${JSON.stringify(
                  urlMention.specifier,
                )})`
              }
              return versionedSpecifier
            })
            urlInfo.sourcemapUrl = generateSourcemapUrl(urlInfo.url) // make sourcemap url use the version
            updateContentAndSourcemap(urlInfo, {
              content,
              sourcemap,
              sourcemapMethod,
            })
          }
        }),
      )

      Object.keys(buildGraph.urlInfos).forEach((buildUrl) => {
        const buildUrlInfo = buildGraph.getUrlInfo(buildUrl)
        if (!buildUrlInfo.data.isEntryPoint) {
          return
        }
        injectVersionMapping(buildUrlInfo, { versionMappings, sourcemapMethod })
      })
    } catch (e) {
      urlVersioningLog.fail()
      throw e
    }
    urlVersioningLog.done()
  }

  const buildFileContents = {}
  Object.keys(buildGraph.urlInfos).forEach((url) => {
    const buildUrlInfo = buildGraph.getUrlInfo(url)
    const buildUrl = buildUrlInfo.url
    const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl)
    buildFileContents[buildRelativeUrl] = buildUrlInfo.content
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
  return {
    buildFileContents,
  }
}

const injectVersionIntoSpecifier = ({
  specifier,
  version,
  versioningMethod,
}) => {
  if (versioningMethod === "search_param") {
    return injectQueryParamsIntoSpecifier(specifier, {
      v: version,
    })
  }
  const url = new URL(specifier, "https://jsenv.dev")
  const basename = urlToBasename(url)
  const extension = urlToExtension(url)
  const versionedFilename = `${basename}-${version}${extension}`
  const versionedUrl = setUrlFilename(url, versionedFilename)
  return isValidUrl(specifier)
    ? versionedUrl
    : `/${urlToRelativeUrl(versionedUrl, "https://jsenv.dev")}`
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
