/*
 * As a first step, and maybe forever we will try to
 * output esmodule and fallback to systemjs
 * The fallback to systemjs will be done later
 * The other formats we'll see afterwards
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

import { createKitchen } from "../omega/kitchen/kitchen.js"
import { parseUrlMentions } from "../omega/url_mentions/parse_url_mentions.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { buildWithRollup } from "./build_with_rollup.js"

export const buildProject = async ({
  signal = new AbortController().signal,
  logLevel = "info",
  projectDirectoryUrl,
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
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const entryUrls = Object.keys(entryPoints).map(
    (key) => new URL(key, projectDirectoryUrl).href,
  )
  const projectGraph = createUrlGraph({
    rootDirectoryUrl: projectDirectoryUrl,
  })
  const loadProjectGraphLog = createTaskLog("load project graph")
  let urlCount = 0
  const projectKitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl: projectDirectoryUrl,
    urlGraph: projectGraph,
    plugins: [
      ...plugins,
      {
        name: "jsenv:build_log",
        appliesDuring: { build: true },
        cooked: () => {
          urlCount++
          loadProjectGraphLog.setRightText(urlCount)
        },
      },
    ],
    scenario: "build",
    sourcemapInjection,
  })
  try {
    await loadUrlGraph({
      urlGraph: projectGraph,
      kitchen: projectKitchen,
      entryUrls,
      outDirectoryName: "build",
      runtimeSupport,
    })
  } catch (e) {
    loadProjectGraphLog.fail()
    throw e
  }
  // here we can perform many checks such as ensuring ressource hints are used
  loadProjectGraphLog.done()
  logger.info(createUrlGraphSummary(projectGraph))

  const jsModulesUrlsToBuild = []
  const cssUrlsToBuild = []
  entryUrls.forEach((entryPointUrl) => {
    const entryPointUrlInfo = projectGraph.getUrlInfo(entryPointUrl)
    if (entryPointUrlInfo.type === "html") {
      entryPointUrlInfo.dependencies.forEach((dependencyUrl) => {
        const dependencyUrlInfo = projectGraph.getUrlInfo(dependencyUrl)
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
    if (entryPointUrlInfo.type === "js_module") {
      jsModulesUrlsToBuild.push(entryPointUrlInfo.url)
      return
    }
    if (entryPointUrlInfo.type === "css") {
      cssUrlsToBuild.push(entryPointUrlInfo.url)
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
        projectDirectoryUrl,
        buildDirectoryUrl,
        projectGraph,
        jsModulesUrlsToBuild,

        runtimeSupport,
        sourcemapInjection,
      })
      const { jsModuleInfos } = rollupBuild
      Object.keys(jsModuleInfos).forEach((url) => {
        const jsModuleInfo = jsModuleInfos[url]
        buildUrlInfos[url] = {
          type: "js_module",
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
    baseUrl,
  })
  const buildGraph = createUrlGraph({
    rootDirectoryUrl: buildDirectoryUrl,
  })
  const buildKitchen = createKitchen({
    rootDirectoryUrl: buildDirectoryUrl,
    injectJsenvPlugins: false,
    plugins: [
      {
        name: "jsenv:postbuild",
        appliesDuring: { postbuild: true },
        resolve: ({ parentUrl, specifier }) => {
          const url = new URL(specifier, parentUrl).href
          return url
        },
        redirect: ({ url }) => {
          const urlInfo = buildUrlInfos[url] || projectGraph.getUrlInfo(url)
          const { buildUrl } = buildUrlsGenerator.generate(
            url,
            urlInfo.type === "js_module" ? "/" : "assets/",
          )
          return buildUrl
        },
        load: ({ url }) => {
          // the url is the build url
          // we must map it back to the "original url"
          // then decide
          // TODO:
          // load from rollup if exists, otherwise from project graph

          const projectUrlInfo = projectGraph.getUrlInfo(url)
          if (projectUrlInfo) {
            return {
              contentType: projectUrlInfo.contentType,
              content: projectUrlInfo.content,
              sourcemap: projectUrlInfo.sourcemap,
            }
          }
          // what??
        },
      },
    ],
    scenario: "postbuild",
  })
  const loadBuilGraphLog = createTaskLog("load build graph")
  try {
    await loadUrlGraph({
      urlGraph: buildGraph,
      kitchen: buildKitchen,
      entryUrls,
      outDirectoryName: "postbuild",
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
          if (dependencyUrlInfo.version) {
            urlVersionGenerator.augmentWithDependencyVersion(
              dependencyUrlInfo.version,
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
        urlInfo.version = urlVersionGenerator.generate()
      })
      // replace all urls to inject versions
      await Promise.all(
        urlsSorted.map(async (url) => {
          const urlInfo = buildGraph.getUrlInfo(url)
          const { urlMentions, replaceUrls } = await parseUrlMentions({
            url: urlInfo.url,
            type: urlInfo.type,
            content: urlInfo.content,
          })
          const replacements = {}
          urlMentions.forEach((urlMention) => {
            // TODO: if url mention is versioned
            // (all urls are, oh yeah but no, not import meta url, not dynamic imports)
            // static import we have no choice until importmap is supported
            // the rest must use versioned url
          })
          const { content } = await replaceUrls(replacements)
          urlInfo.content = content
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

  /* :check: build done in 1s
   * --- 1 build file ----
   * dist/file.js (10ko)
   * --- build summary ---
   * - build files: 1 (10 ko)
   * - build sourcemap files: none
   * ----------------------
   */
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
