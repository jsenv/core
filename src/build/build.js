/*
 * Things hapenning here:
 * 1. load raw build files
 * 2. bundle files
 * 3. optimize files (minify mostly)
 * 4. urls versioning
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

import { createTaskLog } from "@jsenv/utils/logs/task_log.js"
import {
  injectQueryParams,
  setUrlFilename,
} from "@jsenv/utils/urls/url_utils.js"
import { createUrlVersionGenerator } from "@jsenv/utils/urls/url_version_generator.js"
import { generateSourcemapUrl } from "@jsenv/utils/sourcemap/sourcemap_utils.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
} from "@jsenv/utils/html_ast/html_ast.js"

import { defaultRuntimeSupport } from "../omega/runtime_support/default_runtime_support.js"
import { jsenvPluginInline } from "../omega/core_plugins/inline/jsenv_plugin_inline.js"
import { createUrlGraph } from "../omega/url_graph.js"
import { getCorePlugins } from "../omega/core_plugins.js"
import { createKitchen } from "../omega/kitchen.js"
import { loadUrlGraph } from "../omega/url_graph/url_graph_load.js"
import { createUrlGraphSummary } from "../omega/url_graph/url_graph_report.js"
import { sortUrlGraphByDependencies } from "../omega/url_graph/url_graph_sort.js"

import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { injectVersionMappings } from "./inject_version_mappings.js"
import { jsenvPluginBundleJsModule } from "./plugins/bundle_js_module/jsenv_plugin_bundle_js_module.js"
import { jsenvPluginMinifyJs } from "./plugins/minify_js/jsenv_plugin_minify_js.js"
import { jsenvPluginMinifyHtml } from "./plugins/minify_html/jsenv_plugin_minify_html.js"

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
  htmlSupervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  babel,
  runtimeSupport = defaultRuntimeSupport,
  sourcemaps = isPreview ? "file" : false,

  bundling = true,
  minify = true,
  versioning = "filename", //  "filename", "search_param", "none"
  lineBreakNormalization = process.platform === "win32",

  writeOnFileSystem = true,
  buildDirectoryClean = true,
  baseUrl = "/",
  assetManifest = true,
  assetManifestFileRelativeUrl = "asset-manifest.json",
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)
  assertEntryPoints({ entryPoints })
  if (!["filename", "search_param", "none"].includes(versioning)) {
    throw new Error(
      `Unexpected "versioning": must be "filename", "search_param" or "none"; got ${versioning}`,
    )
  }

  const entryPointKeys = Object.keys(entryPoints)
  if (entryPointKeys.length === 1) {
    logger.info(`
build "${entryPointKeys[0]}"`)
  } else {
    logger.info(`
build ${entryPointKeys.length} entry points`)
  }
  const rawGraph = createUrlGraph()
  const prebuildTask = createTaskLog(logger, "prebuild")
  let urlCount = 0
  const rawGraphKitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph: rawGraph,
    plugins: [
      ...plugins,
      {
        name: "jsenv:build_log",
        appliesDuring: { build: true },
        cooked: () => {
          urlCount++
          prebuildTask.setRightText(urlCount)
        },
      },
      ...getCorePlugins({
        htmlSupervisor,
        nodeEsmResolution,
        fileSystemMagicResolution,
        babel,
      }),
      jsenvPluginBundleJsModule(),
      ...(minify ? [jsenvPluginMinifyJs(), jsenvPluginMinifyHtml()] : []),
    ],
    scenario: "build",
    sourcemaps,
  })
  const entryUrls = []
  try {
    await loadUrlGraph({
      urlGraph: rawGraph,
      kitchen: rawGraphKitchen,
      outDirectoryUrl: new URL(`.jsenv/build/`, rootDirectoryUrl),
      runtimeSupport,
      startLoading: (cookEntryFile) => {
        Object.keys(entryPoints).forEach((key) => {
          const [, entryUrlInfo] = cookEntryFile({
            trace: `"${key}" in entryPoints parameter`,
            type: "entry_point",
            specifier: key,
          })
          entryUrls.push(entryUrlInfo.url)
        })
      },
    })
  } catch (e) {
    prebuildTask.fail()
    throw e
  }
  // here we can perform many checks such as ensuring ressource hints are used
  prebuildTask.done()
  logger.debug(
    `raw graph urls:
${Object.keys(rawGraph.urlInfos).join("\n")}`,
  )

  const bundleUrlInfos = {}
  if (bundling) {
    const bundlers = {}
    rawGraphKitchen.pluginController.plugins.forEach((plugin) => {
      const bundle = plugin.bundle
      if (!bundle) {
        return
      }
      if (typeof bundle !== "object") {
        throw new Error(
          `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
        )
      }
      Object.keys(bundle).forEach((type) => {
        const bundlerForThatType = bundlers[type]
        if (bundlerForThatType) {
          // first plugin to define a bundle hook wins
          return
        }
        bundlers[type] = {
          plugin,
          bundleFunction: bundle[type],
          urlInfos: [],
        }
      })
    })
    const addToBundlerIfAny = (rawUrlInfo) => {
      const bundler = bundlers[rawUrlInfo.type]
      if (bundler) {
        bundler.urlInfos.push(rawUrlInfo)
        return
      }
    }
    Object.keys(rawGraph.urlInfos).forEach((rawUrl) => {
      const rawUrlInfo = rawGraph.getUrlInfo(rawUrl)
      if (rawUrlInfo.data.isEntryPoint) {
        addToBundlerIfAny(rawUrlInfo)
        if (rawUrlInfo.type === "html") {
          rawUrlInfo.dependencies.forEach((dependencyUrl) => {
            const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl)
            if (dependencyUrlInfo.isInline) {
              if (dependencyUrlInfo.type === "js_module") {
                // bundle inline script type module deps
                dependencyUrlInfo.references.forEach((inlineScriptRef) => {
                  if (inlineScriptRef.type === "js_import_export") {
                    addToBundlerIfAny(rawGraph.getUrlInfo(inlineScriptRef.url))
                  }
                })
              }
              // inline content cannot be bundled
              return
            }
            addToBundlerIfAny(dependencyUrlInfo)
          })
          return
        }
      }
      // File referenced with new URL('./file.js', import.meta.url)
      // are entry points that can be bundled
      // For instance we will bundle service worker/workers detected like this
      if (rawUrlInfo.type === "js_module") {
        rawUrlInfo.references.forEach((reference) => {
          if (reference.type === "js_import_meta_url_pattern") {
            const urlInfo = rawGraph.getUrlInfo(reference.url)
            addToBundlerIfAny(urlInfo)
          }
        })
      }
    })
    await Object.keys(bundlers).reduce(async (previous, type) => {
      await previous
      const bundler = bundlers[type]
      const urlInfosToBundle = bundler.urlInfos
      if (urlInfosToBundle.length === 0) {
        return
      }
      const bundleTask = createTaskLog(logger, `bundle "${type}"`)
      try {
        const bundlerGeneratedUrlInfos =
          await rawGraphKitchen.pluginController.callAsyncHook(
            {
              plugin: bundler.plugin,
              hookName: "bundle",
              value: bundler.bundleFunction,
            },
            urlInfosToBundle,
            {
              signal,
              logger,
              rootDirectoryUrl,
              buildDirectoryUrl,
              urlGraph: rawGraph,
              runtimeSupport,
              sourcemaps,
            },
          )
        Object.keys(bundlerGeneratedUrlInfos).forEach((url) => {
          const bundleUrlInfo = bundlerGeneratedUrlInfos[url]
          const rawUrlInfo = rawGraph.getUrlInfo(url)
          bundleUrlInfos[url] = {
            type,
            ...bundleUrlInfo,
            data: {
              ...(rawUrlInfo ? rawUrlInfo.data : {}),
              ...bundleUrlInfo.data,
              fromBundle: true,
            },
          }
        })
      } catch (e) {
        bundleTask.fail()
        throw e
      }
      bundleTask.done()
    }, Promise.resolve())
  }

  const buildUrlsGenerator = createBuilUrlsGenerator({
    buildDirectoryUrl,
  })
  const rawUrls = {}
  const buildUrls = {}
  const finalGraph = createUrlGraph()
  const optimizeHooks = rawGraphKitchen.pluginController.addHook("optimize")
  const finalGraphKitchen = createKitchen({
    logger,
    rootDirectoryUrl,
    urlGraph: finalGraph,
    // Inline content, such as <script> inside html, is transformed during the previous phase.
    // If we read the inline content it would be considered as the original content.
    // - It could be "fixed" by taking into account sourcemap and consider sourcemap sources
    //   as the original content.
    //   - But it would not work when sourcemap are not generated
    //   - would be a bit slower
    // - So instead of reading the inline content directly, we search into raw graph
    //   to get "originalContent" and "sourcemap"
    loadInlineUrlInfos: (finalUrlInfo) => {
      const rawUrl = finalUrlInfo.data.rawUrl
      const bundleUrlInfo = bundleUrlInfos[rawUrl]
      const urlInfo = bundleUrlInfo || finalUrlInfo
      const rawUrlInfo = rawGraph.getUrlInfo(rawUrl)
      return {
        originalContent: rawUrlInfo ? rawUrlInfo.originalContent : undefined,
        sourcemap: bundleUrlInfo
          ? bundleUrlInfo.sourcemap
          : rawUrlInfo
          ? rawUrlInfo.sourcemap
          : undefined,
        contentType: urlInfo.contentType,
        content: urlInfo.content,
      }
    },
    plugins: [
      jsenvPluginInline(),
      {
        name: "jsenv:postbuild",
        appliesDuring: { build: true },
        resolve: (reference) => {
          if (reference.specifier[0] === "/") {
            const url = new URL(reference.specifier.slice(1), rootDirectoryUrl)
              .href
            return url
          }
          const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
          if (parentUrlInfo && parentUrlInfo.data.fromBundle) {
            // code generated by rollup contains specifier relative
            // to the generated file.
            // This file does not exists yet we must resolve against the raw url, not the build url
            const parentRawUrl = parentUrlInfo.data.rawUrl
            const rawUrl = new URL(reference.specifier, parentRawUrl).href
            return rawUrl
          }
          return new URL(reference.specifier, reference.parentUrl).href
        },
        normalize: (reference) => {
          if (!reference.url.startsWith("file:")) {
            return null
          }
          // already a build url
          const rawUrl = rawUrls[reference.url]
          if (rawUrl) {
            reference.data.rawUrl = rawUrl
            return reference.url
          }
          const bundleUrlInfo = bundleUrlInfos[reference.url]
          // from rollup or postcss
          if (bundleUrlInfo) {
            const buildUrl = buildUrlsGenerator.generate(
              reference.url,
              bundleUrlInfo,
            )
            reference.data.rawUrl = reference.url
            rawUrls[buildUrl] = reference.url
            return buildUrl
          }
          const rawUrlInfo = rawGraph.getUrlInfo(reference.url)
          // files from root directory but not given to rollup nor postcss
          if (rawUrlInfo) {
            const buildUrl = buildUrlsGenerator.generate(
              reference.url,
              rawUrlInfo,
            )
            reference.data.rawUrl = reference.url
            rawUrls[buildUrl] = reference.url
            return buildUrl
          }
          if (reference.isInline) {
            const rawUrl = Object.keys(rawGraph.urlInfos).find((url) => {
              const rawUrlInfo = rawGraph.urlInfos[url]
              if (!rawUrlInfo.isInline) {
                return false
              }
              if (rawUrlInfo.content === reference.content) {
                return true
              }
              return false
            })
            if (!rawUrl) {
              throw new Error(`cannot find raw url`)
            }
            const rawUrlInfo = rawGraph.getUrlInfo(rawUrl)
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
            const buildUrl = buildUrlsGenerator.generate(
              reference.url,
              rawUrlInfo,
              parentUrlInfo,
            )
            rawUrls[buildUrl] = reference.url
            reference.data.rawUrl = rawUrl
            return buildUrl
          }
          if (reference.type === "sourcemap_comment") {
            // inherit parent build url
            return generateSourcemapUrl(reference.parentUrl)
          }
          // files generated during the final graph (sourcemaps)
          // const finalUrlInfo = finalGraph.getUrlInfo(url)
          const buildUrl = buildUrlsGenerator.generate(reference.url, {
            data: {},
            type: "asset",
          })
          return buildUrl
        },
        formatReferencedUrl: (reference) => {
          if (!reference.url.startsWith("file:")) {
            return null
          }
          if (!urlIsInsideOf(reference.url, buildDirectoryUrl)) {
            throw new Error(
              `urls should be inside build directory at this stage, found "${reference.url}"`,
            )
          }
          // if a file is in the same directory we could prefer the relative notation
          // but to keep things simple let's keep the notation relative to baseUrl for now
          const specifier = `${baseUrl}${urlToRelativeUrl(
            reference.url,
            buildDirectoryUrl,
          )}`
          buildUrls[specifier] = reference.url
          return specifier
        },
        load: (finalUrlInfo) => {
          const rawUrl = finalUrlInfo.data.rawUrl
          const bundleUrlInfo = bundleUrlInfos[rawUrl]
          const urlInfo = bundleUrlInfo || rawGraph.getUrlInfo(rawUrl)
          return {
            data: bundleUrlInfo ? bundleUrlInfo.data : undefined,
            originalContent: urlInfo.originalContent,
            contentType: urlInfo.contentType,
            content: urlInfo.content,
            sourcemap: urlInfo.sourcemap,
          }
        },
        transform: {
          html: (urlInfo) => {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false,
            })
            return {
              content: stringifyHtmlAst(htmlAst, {
                removeOriginalPositionAttributes: true,
              }),
            }
          },
        },
      },
      {
        name: "jsenv:optimize",
        appliesDuring: { build: true },
        transform: async (urlInfo, context) => {
          if (optimizeHooks.length) {
            await rawGraphKitchen.pluginController.callAsyncHooks(
              "optimize",
              urlInfo,
              context,
              async (optimizeReturnValue) => {
                await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
                  urlInfo,
                  optimizeReturnValue,
                )
              },
            )
          }
        },
      },
    ],
    scenario: "build",
    sourcemaps,
  })
  const buildTask = createTaskLog(logger, "build")
  const postBuildEntryUrls = []
  try {
    await loadUrlGraph({
      urlGraph: finalGraph,
      kitchen: finalGraphKitchen,
      outDirectoryUrl: new URL(".jsenv/postbuild/", rootDirectoryUrl),
      runtimeSupport,
      startLoading: (cookEntryFile) => {
        entryUrls.forEach((entryUrl) => {
          const [, postBuildEntryUrlInfo] = cookEntryFile({
            trace: `entryPoint`,
            type: "entry_point",
            specifier: entryUrl,
          })
          postBuildEntryUrls.push(postBuildEntryUrlInfo.url)
        })
      },
    })
  } catch (e) {
    buildTask.fail()
    throw e
  }
  buildTask.done()

  logger.debug(
    `graph urls pre-versioning:
${Object.keys(finalGraph.urlInfos).join("\n")}`,
  )
  if (versioning !== "none") {
    const versioningTask = createTaskLog(logger, "inject version in urls")
    try {
      const urlsSorted = sortUrlGraphByDependencies(finalGraph)
      urlsSorted.forEach((url) => {
        if (url.startsWith("data:")) {
          return
        }
        const urlInfo = finalGraph.getUrlInfo(url)
        if (urlInfo.type === "sourcemap") {
          return
        }
        if (urlInfo.isInline) {
          return
        }
        const urlVersionGenerator = createUrlVersionGenerator()
        urlVersionGenerator.augmentWithContent({
          content: urlInfo.content,
          contentType: urlInfo.contentType,
          lineBreakNormalization,
        })
        urlInfo.dependencies.forEach((dependencyUrl) => {
          const dependencyUrlInfo = finalGraph.getUrlInfo(dependencyUrl)
          if (dependencyUrlInfo.isInline) {
            // this content is part of the file, no need to take into account twice
            return
          }
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
          versioning,
        })
      })
      const versionMappings = {}
      const usedVersionMappings = []
      const versioningKitchen = createKitchen({
        logger,
        rootDirectoryUrl: buildDirectoryUrl,
        urlGraph: finalGraph,
        loadInlineUrlInfos: (versionedUrlInfo) => {
          const rawUrlInfo = rawGraph.getUrlInfo(versionedUrlInfo.data.rawUrl)
          const finalUrlInfo = finalGraph.getUrlInfo(versionedUrlInfo.url)
          return {
            originalContent: rawUrlInfo
              ? rawUrlInfo.originalContent
              : undefined,
            sourcemap: finalUrlInfo ? finalUrlInfo.sourcemap : undefined,
            contentType: versionedUrlInfo.contentType,
            content: versionedUrlInfo.content,
          }
        },
        plugins: [
          jsenvPluginInline({
            allowEscapeForVersioning: true,
          }),
          {
            name: "jsenv:versioning",
            appliesDuring: { build: true },
            resolve: (reference) => {
              const buildUrl = buildUrls[reference.specifier]
              if (buildUrl) {
                return buildUrl
              }
              const url = new URL(reference.specifier, reference.parentUrl).href
              return url
            },
            formatReferencedUrl: (reference) => {
              if (reference.isInline) {
                return null
              }
              // specifier comes from "normalize" hook done a bit earlier in this file
              // we want to get back their build url to access their infos
              const referencedUrlInfo = finalGraph.getUrlInfo(reference.url)
              if (referencedUrlInfo.data.isEntryPoint) {
                return reference.specifier
              }
              // data:* urls and so on
              if (!referencedUrlInfo.url.startsWith("file:")) {
                return null
              }
              const versionedUrl = referencedUrlInfo.data.versionedUrl
              if (!versionedUrl) {
                // happens for sourcemap
                return `${baseUrl}${urlToRelativeUrl(
                  referencedUrlInfo.url,
                  buildDirectoryUrl,
                )}`
              }
              const versionedSpecifier = `${baseUrl}${urlToRelativeUrl(
                versionedUrl,
                buildDirectoryUrl,
              )}`
              versionMappings[reference.specifier] = versionedSpecifier
              const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
              if (parentUrlInfo.jsQuote) {
                // the url is inline inside js quotes
                usedVersionMappings.push(reference.specifier)
                return () =>
                  `${parentUrlInfo.jsQuote}+__v__(${JSON.stringify(
                    reference.specifier,
                  )})+${parentUrlInfo.jsQuote}`
              }
              if (
                reference.type === "js_import_meta_url_pattern" ||
                reference.subtype === "import_dynamic"
              ) {
                usedVersionMappings.push(reference.specifier)
                return () => `__v__(${JSON.stringify(reference.specifier)})`
              }
              return versionedSpecifier
            },
            load: ({ url }) => {
              const urlInfo = finalGraph.getUrlInfo(url)
              return {
                originalContent: urlInfo.originalContent,
                contentType: urlInfo.contentType,
                content: urlInfo.content,
                sourcemap: urlInfo.sourcemap,
              }
            },
          },
        ],
        scenario: "build",
        sourcemaps,
      })
      // arrange state before reloading all files
      Object.keys(finalGraph.urlInfos).forEach((url) => {
        const urlInfo = finalGraph.urlInfos[url]
        urlInfo.data.promise = null
      })
      await loadUrlGraph({
        urlGraph: finalGraph,
        kitchen: versioningKitchen,
        runtimeSupport,
        startLoading: (cookEntryFile) => {
          postBuildEntryUrls.forEach((postBuildEntryUrl) => {
            cookEntryFile({
              trace: `entryPoint`,
              type: "entry_point",
              specifier: postBuildEntryUrl,
            })
          })
        },
      })
      if (usedVersionMappings.length) {
        const versionMappingsNeeded = {}
        usedVersionMappings.forEach((specifier) => {
          versionMappingsNeeded[specifier] = versionMappings[specifier]
        })
        await Promise.all(
          Object.keys(finalGraph.urlInfos).map(async (buildUrl) => {
            const buildUrlInfo = finalGraph.getUrlInfo(buildUrl)
            if (!buildUrlInfo.data.isEntryPoint) {
              return
            }
            await injectVersionMappings(buildUrlInfo, {
              kitchen: finalGraphKitchen,
              versionMappings: versionMappingsNeeded,
            })
          }),
        )
      }
    } catch (e) {
      versioningTask.fail()
      throw e
    }
    versioningTask.done()
  }

  const buildFileContents = {}
  const buildInlineFileContents = {}
  const buildManifest = {}
  Object.keys(finalGraph.urlInfos).forEach((url) => {
    if (!url.startsWith("file:")) {
      return
    }
    const buildUrlInfo = finalGraph.getUrlInfo(url)
    const versionedUrl = buildUrlInfo.data.versionedUrl
    const useVersionedUrl = versionedUrl && !buildUrlInfo.data.isEntryPoint
    const buildUrl = useVersionedUrl ? versionedUrl : buildUrlInfo.url
    if (!urlIsInsideOf(buildUrl, buildDirectoryUrl)) {
      throw new Error(`build url outside build directory`)
    }
    const buildRelativeUrl = urlToRelativeUrl(buildUrl, buildDirectoryUrl)
    if (buildUrlInfo.isInline) {
      buildInlineFileContents[buildRelativeUrl] = buildUrlInfo.content
    } else {
      buildFileContents[buildRelativeUrl] = buildUrlInfo.content
    }
    if (useVersionedUrl) {
      const buildRelativeUrlWithoutVersioning = urlToRelativeUrl(
        buildUrlInfo.url,
        buildDirectoryUrl,
      )
      buildManifest[buildRelativeUrlWithoutVersioning] = buildRelativeUrl
    }
  })
  logger.debug(
    `graph urls post-versioning:
${Object.keys(finalGraph.urlInfos).join("\n")}`,
  )

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
    if (
      versioning !== "none" &&
      assetManifest &&
      Object.keys(buildManifest).length
    ) {
      await writeFile(
        new URL(assetManifestFileRelativeUrl, buildDirectoryUrl),
        JSON.stringify(buildManifest, null, "  "),
      )
    }
  }
  logger.info(createUrlGraphSummary(finalGraph, { title: "build files" }))
  return {
    buildFileContents,
    buildInlineFileContents,
    buildManifest,
  }
}

const injectVersionIntoBuildUrl = ({ buildUrl, version, versioning }) => {
  if (versioning === "search_param") {
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
