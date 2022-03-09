import { fileURLToPath } from "node:url"
import { urlIsInsideOf, writeFile, urlToRelativeUrl } from "@jsenv/filesystem"

import {
  filesystemRootUrl,
  moveUrl,
  injectQueryParams,
} from "@jsenv/core/src/utils/url_utils.js"
import {
  parseJavaScriptSourcemapComment,
  parseCssSourcemapComment,
  generateSourcemapUrl,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"
import { stringifyUrlSite } from "@jsenv/core/old_src/internal/building/url_trace.js"

import { getOriginalUrlSite } from "./original_url_site.js"
import { getJsenvPlugins } from "../jsenv_plugins.js"
import {
  flattenAndFilterPlugins,
  createPluginController,
} from "./plugin_controller.js"
import {
  createResolveError,
  createLoadError,
  createTransformError,
} from "./errors.js"
import { featuresCompatMap } from "./features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "./runtime_support.js"
import { parseHtmlUrlMentions } from "./parse/html/html_url_mentions.js"
import { parseCssUrlMentions } from "./parse/css/css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./parse/js_module/js_module_url_mentions.js"

const parsers = {
  html: parseHtmlUrlMentions,
  css: parseCssUrlMentions,
  js_module: parseJsModuleUrlMentions,
}

export const createKitchen = ({
  signal,
  logger,
  projectDirectoryUrl,
  scenario,
  plugins,
  sourcemapInjection,
  ressourceGraph,
}) => {
  plugins = [...plugins, ...getJsenvPlugins()]
  plugins = flattenAndFilterPlugins(plugins, {
    scenario,
  })

  const urlInfoMap = new Map()
  const baseContext = {
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins,
    sourcemapInjection,
    ressourceGraph,
  }
  const jsenvDirectoryUrl = new URL(".jsenv/", projectDirectoryUrl).href
  const pluginController = createPluginController()

  const resolveSpecifier = async ({ parentUrl, specifierType, specifier }) => {
    if (specifier.startsWith("/@fs/")) {
      const url = new URL(specifier.slice("/@fs".length), projectDirectoryUrl)
        .href
      return url
    }
    if (specifier[0] === "/") {
      const url = new URL(specifier.slice(1), projectDirectoryUrl).href
      return url
    }
    const pluginsToIgnore = []
    const contextDuringResolve = {
      ...baseContext,
      parentUrl,
      specifierType,
      specifier,
      // when "resolve" is called during resolve hook
      // apply other plugin resolve hooks
      resolve: () => {
        pluginsToIgnore.push(pluginController.getCurrentPlugin())
        return callResolveHooks(
          plugins.filter((plugin) => !pluginsToIgnore.includes(plugin)),
        )
      },
    }
    const callResolveHooks = async (pluginsSubset) => {
      const resolveReturnValue = await pluginController.callPluginHooksUntil(
        pluginsSubset,
        "resolve",
        contextDuringResolve,
      )
      if (!resolveReturnValue) {
        return null
      }
      const url = String(resolveReturnValue)
      return url
    }
    const url = await callResolveHooks(plugins)
    return url
  }

  let currentContext
  const _cookUrl = async ({
    outDirectoryName,
    runtimeSupport,
    parentUrl,
    urlSite,
    url,
  }) => {
    const context = {
      ...baseContext,
      resolve: resolveSpecifier,
      cookUrl: async ({ parentUrl, urlSite, url }) => {
        const returnValue = await cookUrl({
          outDirectoryName,
          runtimeSupport,
          parentUrl,
          urlSite,
          url,
        })
        // we are done with that subfile
        // restore currentContext to the current file
        currentContext = context
        return returnValue
      },
      isSupportedOnRuntime: (
        featureName,
        featureCompat = featuresCompatMap[featureName],
      ) => {
        return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
      },
      parentUrl,
      urlSite,
      url,
    }
    const urlObject = new URL(url)
    context.hmr = urlObject.searchParams.has("hmr")
    // - "hmr" search param goal is to tell hmr is enabled for that url
    //   this goal is achieved when we reach this part of the code
    // - "v" search param goal is put url in browser cache or bypass it for hmr
    //   this goal is achieved when we reach this part of the code
    // We get rid of both params so that url is consistent and code such as
    // ressource graph see the same url
    urlObject.searchParams.delete("v")
    urlObject.searchParams.delete("hmr")
    context.url = urlObject.href

    currentContext = context
    context.asClientUrl = (url) => {
      const urlInfo = urlInfoMap.get(url) || {}
      const { urlVersion } = urlInfo
      const clientUrlRaw = url
      const hmrTimestamp = context.hmr
        ? ressourceGraph.getHmrTimestamp(url)
        : null
      const params = {}
      if (hmrTimestamp) {
        params.hmr = ""
        params.v = hmrTimestamp
      } else if (urlVersion) {
        params.v = urlVersion
      }
      const clientUrl = injectQueryParams(clientUrlRaw, params)
      if (urlIsInsideOf(clientUrl, projectDirectoryUrl)) {
        return `/${urlToRelativeUrl(clientUrl, projectDirectoryUrl)}`
      }
      if (clientUrl.startsWith("file:")) {
        return `/@fs/${clientUrl.slice(filesystemRootUrl.length)}`
      }
      return `${clientUrl}`
    }

    // "deriveMetaFromUrl" hook
    let urlMeta = {}
    plugins.forEach((plugin) => {
      const urlMetaFromPlugin = pluginController.callPluginSyncHook(
        plugin,
        "deriveMetaFromUrl",
        context,
      )
      if (urlMetaFromPlugin) {
        urlMeta = {
          ...urlMeta,
          ...urlMetaFromPlugin,
        }
      }
    })
    urlInfoMap.set(context.url, urlMeta) // ideally we should delete when url is pruned

    // "load" hook
    try {
      const loadReturnValue = await pluginController.callPluginHooksUntil(
        plugins,
        "load",
        context,
      )
      if (!loadReturnValue) {
        throw new Error("NO_LOAD")
      }
      const {
        response,
        contentType = "application/octet-stream",
        content, // can be a buffer (used for binary files) or a string
      } = loadReturnValue
      if (response) {
        context.response = response
        return context
      }
      context.contentType = contentType
      context.type = getRessourceType(context)
      context.originalContent = content
      context.content = content
    } catch (error) {
      context.error = createLoadError({
        pluginController,
        urlSite: currentContext.urlSite,
        url: currentContext.url,
        error,
      })
      return context
    }
    context.outUrl = determineFileUrlForOutDirectory({
      projectDirectoryUrl,
      outDirectoryName,
      scenario,
      url: context.url,
    })

    // sourcemap loading
    if (context.contentType === "application/javascript") {
      const sourcemapInfo = parseJavaScriptSourcemapComment(context.content)
      if (sourcemapInfo) {
        context.sourcemap = await loadSourcemap({
          parentUrl: context.url,
          parentLine: sourcemapInfo.line,
          parentColumn: sourcemapInfo.column,
          specifierType: "js_sourcemap_comment",
          specifier: sourcemapInfo.specifier,
        })
      }
    } else if (context.contentType === "text/css") {
      const sourcemapInfo = parseCssSourcemapComment(context.content)
      if (sourcemapInfo) {
        context.sourcemap = await loadSourcemap({
          parentUrl: context.url,
          parentLine: sourcemapInfo.line,
          parentColumn: sourcemapInfo.column,
          specifierType: "css_sourcemap_comment",
          specifier: sourcemapInfo.specifier,
        })
      }
    }

    // "transform" hook
    const updateContents = (data) => {
      if (data) {
        const { contentType, content, sourcemap } = data
        if (contentType) {
          context.contentType = contentType
        }
        context.content = content
        if (sourcemap) {
          context.sourcemap = composeTwoSourcemaps(context.sourcemap, sourcemap)
        }
      }
    }
    try {
      await plugins.reduce(async (previous, plugin) => {
        await previous
        const transformReturnValue = await pluginController.callPluginHook(
          plugin,
          "transform",
          context,
        )
        updateContents(transformReturnValue)
      }, Promise.resolve())
    } catch (error) {
      context.error = createTransformError({
        pluginController,
        urlSite: currentContext.urlSite,
        url: currentContext.url,
        type: currentContext.type,
        error,
      })
      return context
    }

    // parsing + "parsed" hook
    const parser = parsers[context.type]
    const {
      urlMentions = [],
      getHotInfo = () => ({}),
      transformUrlMentions,
    } = parser ? await parser(context) : {}
    const dependencyUrls = []
    const dependencyUrlSites = {}
    for (const urlMention of urlMentions) {
      const urlInfo = urlInfoMap.get(url) || {}
      const specifierUrlSite = stringifyUrlSite(
        await getOriginalUrlSite({
          originalUrl: context.url,
          originalContent: context.originalContent,
          originalLine: urlMention.originalLine,
          originalColumn: urlMention.originalColumn,
          ownerUrl: urlInfo.ownerUrl,
          ownerLine: urlInfo.ownerLine,
          ownerColumn: urlInfo.ownerColumn,
          ownerContent: urlInfo.ownerContent,
          url: context.outUrl,
          content: context.content,
          line: urlMention.line,
          column: urlMention.column,
          sourcemap: context.sourcemap,
        }),
      )

      try {
        const resolvedUrl = await resolveSpecifier({
          parentUrl: context.url,
          specifierType: urlMention.type,
          specifier: urlMention.specifier,
        })
        if (resolvedUrl === null) {
          throw new Error(`NO_RESOLVE`)
        }
        urlMention.url = resolvedUrl
        dependencyUrlSites[resolvedUrl] = specifierUrlSite
        dependencyUrls.push(resolvedUrl)
      } catch (error) {
        context.error = createResolveError({
          pluginController,
          specifierUrlSite,
          specifier: urlMention.specifier,
          error,
        })
        return context
      }
    }
    const {
      hotDecline = false,
      hotAcceptSelf = false,
      hotAcceptDependencies = [],
    } = getHotInfo()
    Object.assign(context, {
      urlMentions,
      hotDecline,
      hotAcceptSelf,
      hotAcceptDependencies,
    })
    ressourceGraph.updateRessourceDependencies({
      url: context.url,
      type: context.type,
      dependencyUrls,
      dependencyUrlSites,
      hotDecline,
      hotAcceptSelf,
      hotAcceptDependencies,
    })
    await plugins.reduce(async (previous, plugin) => {
      await previous
      const cookedReturnValue = await pluginController.callPluginHook(
        plugin,
        "cooked",
        context,
      )
      if (typeof cookedReturnValue === "function") {
        const removePrunedCallback = ressourceGraph.prunedCallbackList.add(
          (prunedRessource) => {
            if (prunedRessource.url === context.url) {
              removePrunedCallback()
              cookedReturnValue()
            }
          },
        )
      }
    }, Promise.resolve())
    if (transformUrlMentions) {
      const transformReturnValue = await transformUrlMentions({
        transformUrlMention: (urlMention) => {
          const clientUrl = context.asClientUrl(urlMention.url)
          return clientUrl
        },
      })
      updateContents(transformReturnValue)
    }

    // sourcemap injection
    const { sourcemap } = context
    if (sourcemap) {
      const sourcemapUrl = generateSourcemapUrl(context.url)
      const sourcemapOutUrl = determineFileUrlForOutDirectory({
        projectDirectoryUrl,
        outDirectoryName,
        scenario,
        url: sourcemapUrl,
      })
      context.sourcemapUrl = sourcemapOutUrl
      context.content = injectSourcemap(context)
    }

    // "finalize" hook
    const finalizeReturnValue = await pluginController.callPluginHooksUntil(
      plugins,
      "finalize",
      context,
    )
    updateContents(finalizeReturnValue)

    return context
  }
  const cookUrl = async (params) => {
    try {
      const context = await _cookUrl(params)
      // writing result inside ".jsenv" directory (debug purposes)
      if (context.sourcemap) {
        if (sourcemapInjection === "comment") {
          await writeFile(
            context.sourcemapUrl,
            JSON.stringify(context.sourcemap, null, "  "),
          )
        } else if (sourcemapInjection === "inline") {
          writeFile(
            context.sourcemapUrl,
            JSON.stringify(context.sourcemap, null, "  "),
          )
        }
      }
      if (context.outUrl) {
        writeFile(context.outUrl, context.content)
      }
      return context
    } catch (e) {
      throw e
    }
  }
  const loadSourcemap = async ({ parentUrl, specifierType, specifier }) => {
    const sourcemapUrl = await resolveSpecifier({
      parentUrl,
      specifierType,
      specifier,
    })
    const sourcemapContext = await cookUrl({
      parentUrl,
      url: sourcemapUrl,
    })
    if (sourcemapContext.error) {
      logger.error(
        `Error while handling sourcemap: ${sourcemapContext.error.message}`,
      )
      return null
    }
    const sourcemap = JSON.parse(sourcemapContext.content)
    sourcemap.sources = sourcemap.sources.map((source) => {
      return fileURLToPath(new URL(source, sourcemapContext.url).href)
    })
    return sourcemap
  }

  return {
    jsenvDirectoryUrl,
    resolveSpecifier,
    cookUrl,
  }
}

const getRessourceType = ({ url, contentType }) => {
  if (contentType === "text/html") {
    return "html"
  }
  if (contentType === "text/css") {
    return "css"
  }
  if (contentType === "application/javascript") {
    return new URL(url).searchParams.has("script") ? "js_classic" : "js_module"
  }
  if (contentType === "application/json") {
    return "json"
  }
  if (contentType === "application/importmap+json") {
    return "importmap"
  }
  return "other"
}

// this is just for debug (ability to see what is generated)
const determineFileUrlForOutDirectory = ({
  projectDirectoryUrl,
  outDirectoryName,
  scenario,
  url,
}) => {
  if (!urlIsInsideOf(url, projectDirectoryUrl)) {
    url = `${projectDirectoryUrl}@fs/${url.slice(filesystemRootUrl.length)}`
  }
  const outDirectoryUrl = new URL(
    `.jsenv/${scenario}/${outDirectoryName}/`,
    projectDirectoryUrl,
  ).href
  return moveUrl(url, projectDirectoryUrl, outDirectoryUrl)
}
