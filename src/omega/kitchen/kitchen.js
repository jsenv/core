import { urlIsInsideOf, writeFile, urlToRelativeUrl } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

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

import { createPluginController } from "./plugin_controller.js"
import { featuresCompatMap } from "./features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "./runtime_support.js"
import { parseHtmlUrlMentions } from "./parse/html/html_url_mentions.js"
import { parseCssUrlMentions } from "./parse/css/css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./parse/js_module/js_module_url_mentions.js"
import { stringifyUrlSite } from "@jsenv/core/old_src/internal/building/url_trace.js"

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
      cookUrl: async (params) => {
        const returnValue = await cookUrl(params)
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
      url,
    }
    currentContext = context
    context.asClientUrl = (url, parentUrl) => {
      const hmr = new URL(parentUrl).searchParams.has("hmr")
      const urlInfo = urlInfoMap.get(url) || {}
      const { urlVersion } = urlInfo
      const clientUrlRaw = url
      const hmrTimestamp = hmr ? ressourceGraph.getHmrTimestamp(url) : null
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
    urlInfoMap.set(context.url, urlMeta)

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
    } catch (e) {
      let error
      const createFailedToLoadError = ({ code, reason, cause }) => {
        const error = new Error(
          createDetailedMessage(`Failed to load url`, {
            url: currentContext.url,
            reason,
            ...(urlSite ? { "referenced at": urlSite } : null),
          }),
        )
        error.code = code
        error.reason = reason
        error.cause = cause
        return error
      }
      if (e.message === "NO_LOAD") {
        error = createFailedToLoadError({
          code: "NOT_FOUND",
          reason: `all "load" hooks returned null`,
          cause: e,
        })
      } else if (e && e.code === "EPERM") {
        error = createFailedToLoadError({
          code: "NOT_ALLOWED",
          reason: `not allowed to read entry on filesystem`,
          cause: e,
        })
      } else if (e && e.code === "EISDIR") {
        error = createFailedToLoadError({
          code: "NOT_ALLOWED",
          reason: `found a directory on filesystem`,
          cause: e,
        })
      } else if (e && e.code === "ENOENT") {
        error = createFailedToLoadError({
          code: "NOT_FOUND",
          reason: "no entry on filesystem",
          cause: e,
        })
      } else if (e) {
        error = createFailedToLoadError({
          code: "PLUGIN_ERROR",
          reason: `error thrown during "load" by "${pluginController.getCurrentPlugin()}" plugin`,
          cause: e,
        })
      }
      context.error = error
      return context
    }

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
        context.sourcemap = composeTwoSourcemaps(context.sourcemap, sourcemap)
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
    } catch (e) {
      if (e.code === "PARSE_ERROR") {
        context.error = e
      } else {
        context.error = new Error(`Failed to transform ${context.specifierType}
--- reason ---
error thrown during "transform" by "${pluginController.getCurrentPlugin()}" plugin`)
      }
      return context
    }

    // parsing + "parsed" hook
    const onParsed = async ({
      urlMentions = [],
      hotDecline = false,
      hotAcceptSelf = false,
      hotAcceptDependencies = [],
    }) => {
      Object.assign(context, {
        urlMentions,
        hotDecline,
        hotAcceptSelf,
        hotAcceptDependencies,
      })
      const dependencyUrls = []
      const dependencyUrlSites = {}
      urlMentions.forEach((urlMention) => {
        const resolvedUrl =
          urlMention.url || new URL(urlMention.specifier, context.url).href
        dependencyUrls.push(resolvedUrl)
        // TODO: when file is transformed the context.content is not the original
        // one, in that case use eventual sourcemap to get original line and column
        // fallbacking to the transformed line and column when there is no sourcemap
        dependencyUrlSites[resolvedUrl] = stringifyUrlSite({
          url: context.url,
          line: urlMention.line,
          column: urlMention.column,
          content: context.content,
        })
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
        const parsedReturnValue = await pluginController.callPluginHook(
          plugin,
          "parsed",
          context,
        )
        if (typeof parsedReturnValue === "function") {
          const removePrunedCallback = ressourceGraph.prunedCallbackList.add(
            (prunedRessource) => {
              if (prunedRessource.url === context.url) {
                removePrunedCallback()
                parsedReturnValue()
              }
            },
          )
        }
      }, Promise.resolve())
    }
    const parser = parsers[context.type]
    if (parser) {
      const { urlMentions, getHotInfo, transformUrlMentions } = await parser(
        context,
      )
      for (const urlMention of urlMentions) {
        const resolvedUrl = await resolveSpecifier({
          parentUrl: context.url,
          specifierType: urlMention.type,
          specifier: urlMention.specifier,
        })
        // resolvedUrl can be null:
        // in that case we won't touch the specifier
        // and let the browser request the file which will result in 404
        urlMention.url = resolvedUrl
      }
      await onParsed({
        urlMentions,
        ...getHotInfo(),
      })
      const transformReturnValue = await transformUrlMentions({
        transformUrlMention: (urlMention) => {
          if (!urlMention.url) {
            // will result in 404
            return urlMention.specifier
          }
          const clientUrl = context.asClientUrl(urlMention.url, context.url)
          return clientUrl
        },
      })
      updateContents(transformReturnValue)
    } else {
      await onParsed({})
    }

    // sourcemap injection
    const { sourcemap } = context
    if (sourcemap && sourcemapInjection === "comment") {
      const sourcemapUrl = generateSourcemapUrl(context.url)
      const sourcemapOutUrl = determineFileUrlForOutDirectory({
        projectDirectoryUrl,
        outDirectoryName,
        scenario,
        url: sourcemapUrl,
      })
      context.sourcemapUrl = sourcemapOutUrl
      context.content = injectSourcemap(context)
    } else if (sourcemap && sourcemapInjection === "inline") {
      context.sourcemapUrl = generateSourcemapUrl(context.url)
      context.content = injectSourcemap(context)
    }

    // "render" hook
    const renderReturnValue = await pluginController.callPluginHooksUntil(
      plugins,
      "render",
      context,
    )
    updateContents(renderReturnValue)

    // writing result inside ".jsenv" directory (debug purposes)
    if (context.sourcemapUrl) {
      writeIntoRuntimeDirectory({
        projectDirectoryUrl,
        outDirectoryName,
        scenario,
        url: context.sourcemapUrl,
        content: JSON.stringify(sourcemap, null, "  "),
      })
    }
    writeIntoRuntimeDirectory({
      projectDirectoryUrl,
      outDirectoryName,
      scenario,
      url: context.url,
      content: context.content,
    })

    return context
  }
  const cookUrl = async (params) => {
    try {
      return await _cookUrl(params)
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
      return new URL(source, sourcemapContext.url).href
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

const determineFileUrlForOutDirectory = ({
  projectDirectoryUrl,
  outDirectoryName,
  scenario,
  url,
}) => {
  const outDirectoryUrl = new URL(
    `.jsenv/${scenario}/${outDirectoryName}/`,
    projectDirectoryUrl,
  ).href
  return moveUrl(url, projectDirectoryUrl, outDirectoryUrl)
}

// this is just for debug (ability to see what is generated)
const writeIntoRuntimeDirectory = async ({
  projectDirectoryUrl,
  outDirectoryName,
  scenario,

  url,
  content,
}) => {
  if (!urlIsInsideOf(url, projectDirectoryUrl)) {
    return
  }
  await writeFile(
    determineFileUrlForOutDirectory({
      projectDirectoryUrl,
      outDirectoryName,
      scenario,
      url,
    }),
    content,
  )
}
