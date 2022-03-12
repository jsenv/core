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

import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { buildGraph } from "./build_graph.js"
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

  writeOnFileSystem = false,
  buildDirectoryClean = true,
  baseUrl = "/",
}) => {
  const logger = createLogger({ logLevel })
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const buildUrlsGenerator = createBuilUrlsGenerator({
    baseUrl,
  })
  const projectGraph = await buildGraph({
    signal,
    logger,
    projectDirectoryUrl,
    buildUrlsGenerator,
    entryPoints,

    plugins,
    runtimeSupport,
    sourcemapInjection,
  })
  const jsModulesToBuild = []
  Object.keys(entryPoints).forEach((entyrPointRelativeUrl) => {
    const entryPointUrl = new URL(entyrPointRelativeUrl, projectDirectoryUrl)
      .href
    const entryPointUrlInfo = projectGraph.getUrlInfo(entryPointUrl)
    if (entryPointUrlInfo.type === "html") {
      entryPointUrlInfo.dependencies.forEach((dependencyUrl) => {
        const dependencyUrlInfo = projectGraph.getUrlInfo(dependencyUrl)
        if (dependencyUrlInfo.type === "js_module") {
          const urlInfo = projectGraph.getUrlInfo(dependencyUrl)
          jsModulesToBuild.push({
            id: dependencyUrl,
            fileName: urlInfo.buildRelativeUrl,
            // add implicity loaded after one of
          })
        }
      })
      return
    }
    if (entryPointUrlInfo.type === "js_module") {
      jsModulesToBuild.push({
        id: entryPointUrlInfo.url,
        fileName: entryPointUrlInfo.buildRelativeUrl,
      })
      return
    }
  })
  const buildFileContents = {}
  Object.keys(projectGraph.urlInfos).forEach((url) => {
    const urlInfo = projectGraph.urlInfos[url]
    if (urlInfo.type !== "js_module") {
      buildFileContents[urlInfo.buildRelativeUrl] = urlInfo.content
    }
  })
  if (jsModulesToBuild.length) {
    const { jsModuleInfos } = await buildWithRollup({
      signal,
      logger,
      projectDirectoryUrl,
      buildDirectoryUrl,
      buildUrlsGenerator,
      projectGraph,
      jsModulesToBuild,

      runtimeSupport,
      sourcemapInjection,
    })
    Object.keys(jsModuleInfos).forEach((url) => {
      const jsModuleInfo = jsModuleInfos[url]
      buildFileContents[jsModuleInfo.buildRelativeUrl] = jsModuleInfo.content
    })
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
