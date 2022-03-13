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

import { parseUrlMentions } from "../omega/url_mentions/parse_url_mentions.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { loadProjectGraph } from "./load_project_graph.js"
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
  const projectGraph = await loadProjectGraph({
    signal,
    logger,
    projectDirectoryUrl,
    buildUrlsGenerator,
    entryPoints,

    plugins,
    runtimeSupport,
    sourcemapInjection,
  })
  const jsModulesUrlsToBuild = []
  const cssUrlsToBuild = []
  Object.keys(entryPoints).forEach((entyrPointRelativeUrl) => {
    const entryPointUrl = new URL(entyrPointRelativeUrl, projectDirectoryUrl)
      .href
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
  const buildFiles = []
  if (jsModulesUrlsToBuild.length) {
    const { jsModuleInfos } = await buildWithRollup({
      signal,
      logger,
      projectDirectoryUrl,
      buildDirectoryUrl,
      buildUrlsGenerator,
      projectGraph,
      jsModulesUrlsToBuild,

      runtimeSupport,
      sourcemapInjection,
    })
    Object.keys(jsModuleInfos).forEach((url) => {
      const jsModuleInfo = jsModuleInfos[url]
      buildFiles.push({
        url,
        type: "js_module",
        content: jsModuleInfo.content,
        sourcemap: jsModuleInfo.sourcemap,
      })
    })
  }
  if (cssUrlsToBuild.length) {
    // on pourrait concat + minify en utilisant post css
  }
  // TODO: minify html, svg, json

  const buildGraph = {}
  await Object.keys(entryPoints).reduce(
    async (previous, entyrPointRelativeUrl) => {
      await previous
      const entryPointUrl = new URL(entyrPointRelativeUrl, projectDirectoryUrl)
        .href
      const entryPointUrlInfo = projectGraph.getUrlInfo(entryPointUrl)
      // le'ts say html was minified so we need to re-parse it
      if (entryPointUrlInfo.type === "html") {
        const { urlMentions, replaceUrls } = await parseUrlMentions({
          type: entryPointUrlInfo.type,
          url: entryPointUrlInfo.url,
          content: entryPointUrlInfo.content,
        })
        // replace all files that where built by rollup
        const replacements = {}
        urlMentions.forEach((urlMention) => {
          replacements[urlMention.url] = buildUrlsGenerator.generate(
            urlMention.url,
          )
        })
        const { content } = await replaceUrls(replacements)
        entryPointUrlInfo.content = content
      }

      // replace urls in html when they are different
    },
    Promise.resolve(),
  )

  // ok ici on se retrouve dans le cas ou le html fait référence aux vieux fichiers
  // js, on voudrait qu'il pointent vers les fichiers concat
  // il nous faut donc un mapping
  // et on veut faire ça pour toutes les urls
  // des fichiers source qu'on veut en fait redirect sur les fichier de build
  // pour que ça marche on part des points d'entrée et on suit ce qu'on trouve
  // si c'est un fichier buildé on suit le fichier buildé,
  // sinon on suit le fichier source mais on remplacera son url par une url de build
  // quand on a fini tout ça on applique le versioning

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
