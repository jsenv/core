/*
 *
 */

import { writeFileSync } from "node:fs"
import {
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { loadUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph_load.js"
import { createTaskLog } from "@jsenv/core/src/utils/logs/task_log.js"
import { createUrlGraphSummary } from "@jsenv/core/src/utils/url_graph/url_graph_report.js"
import { sortUrlGraphByDependencies } from "@jsenv/core/src/utils/url_graph/url_graph_sort.js"
import { createUrlVersionGenerator } from "@jsenv/core/src/utils/url_version_generator.js"

import { applyLeadingSlashUrlResolution } from "../omega/kitchen/leading_slash_url_resolution.js"
import { createPluginController } from "../omega/kitchen/plugin_controller.js"
import { getJsenvPlugins } from "../omega/jsenv_plugins.js"

import { createKitchen } from "../omega/kitchen/kitchen.js"
import { parseUrlMentions } from "../omega/url_mentions/parse_url_mentions.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { buildWithRollup } from "./build_with_rollup.js"

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
  sourcemapInjection = isPreview ? "comment" : false,

  urlVersioning = true,
  lineBreakNormalization = process.platform === "win32",

  writeOnFileSystem = false,
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
    sourcemapInjection,
    scenario: "build",
    baseUrl,
  })
  let sourceEntryReferences
  try {
    sourceEntryReferences = Object.keys(entryPoints).map((key, index) => {
      const sourceEntryReference = sourceKitchen.createReference({
        trace: `entry point ${index} in "entryPoints" parameter of "generateBuild"`,
        parentUrl: sourceDirectoryUrl,
        type: "entry_point",
        specifier: key,
      })
      return sourceEntryReference
    })
    await loadUrlGraph({
      urlGraph: sourceGraph,
      kitchen: sourceKitchen,
      outDirectoryUrl: new URL(`.jsenv/build/`, sourceDirectoryUrl),
      runtimeSupport,
      startLoading: (cook) => {
        sourceEntryReferences.forEach((sourceEntryReference) => {
          const sourcEntryUrlInfo =
            sourceKitchen.resolveReference(sourceEntryReference)
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
  sourceEntryReferences.forEach((sourceEntryReference) => {
    const sourceEntryUrlInfo = sourceGraph.getUrlInfo(sourceEntryReference.url)
    if (sourceEntryUrlInfo.type === "html") {
      sourceEntryUrlInfo.dependencies.forEach((dependencyUrl) => {
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
    if (sourceEntryUrlInfo.type === "js_module") {
      jsModulesUrlsToBuild.push(sourceEntryUrlInfo.url)
      return
    }
    if (sourceEntryUrlInfo.type === "css") {
      cssUrlsToBuild.push(sourceEntryUrlInfo.url)
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
        sourcemapInjection,
      })
      const { jsModuleInfos } = rollupBuild
      Object.keys(jsModuleInfos).forEach((url) => {
        const jsModuleInfo = jsModuleInfos[url]
        buildUrlInfos[url] = {
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
        redirect: ({ type, url, data }) => {
          const urlInfo = buildUrlInfos[url] || sourceGraph.getUrlInfo(url)
          const buildUrl = buildUrlsGenerator.generate(
            url,
            type === "entry_point" || urlInfo.type === "js_module"
              ? "/"
              : "assets/",
          )
          data.sourceUrl = url
          return buildUrl
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
      outDirectoryName: "postbuild",
      startLoading: (cook) => {
        Object.keys(entryPoints).forEach((key, index) => {
          const buildEntryReference = buildKitchen.createReference({
            trace: `entry point ${index} in "entryPoints" parameter of "generateBuild"`,
            parentUrl: sourceDirectoryUrl,
            type: "entry_point",
            specifier: key,
          })
          const buildEntryUrlInfo =
            buildKitchen.resolveReference(buildEntryReference)
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

  if (urlVersioning) {
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
      // replace all urls to inject versions
      await Promise.all(
        urlsSorted.map(async (url) => {
          const urlInfo = buildGraph.getUrlInfo(url)
          const parseResult = await parseUrlMentions({
            url: urlInfo.url,
            type: urlInfo.type,
            content: urlInfo.content,
          })
          if (parseResult) {
            const { replaceUrls } = parseResult
            const { content } = await replaceUrls((urlMention) => {
              if (
                urlMention.type === "js_import_meta_url_pattern" ||
                urlMention.subtype === "import_dynamic"
              ) {
                // what do we put in JSON.stringify here?
                return `window.__asVersionedSpecifier__(${JSON.stringify("")})`
              }
              return urlInfo.data.version
            })
            // TODO: importmap composition
            urlInfo.content = content
          }
        }),
      )
    } catch (e) {
      urlVersioningLog.fail()
      throw e
    }
    urlVersioningLog.done()
  }

  if (writeOnFileSystem) {
    if (buildDirectoryClean) {
      await ensureEmptyDirectory(buildDirectoryUrl)
    }
    const buildRelativeUrls = Object.keys(buildFileContents)
    buildRelativeUrls.forEach((buildRelativeUrl) => {
      writeFileSync(
        new URL(buildRelativeUrl, buildDirectoryUrl),
        buildFileContents[buildRelativeUrl],
      )
    })
  }
  return null
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
