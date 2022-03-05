import {
  urlIsInsideOf,
  writeFile,
  resolveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import {
  filesystemRootUrl,
  moveUrl,
  injectQueryParams,
} from "@jsenv/core/src/utils/url_utils.js"
import { findAsync } from "@jsenv/core/src/utils/find_async.js"
import {
  getCssSourceMappingUrl,
  getJavaScriptSourceMappingUrl,
  generateSourcemapUrl,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"

import { callPluginHook, callPluginSyncHook } from "./plugin_controller.js"
import { createNotFoundError } from "./errors.js"
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

  let currentContext
  const _cookFile = async ({
    outDirectoryName,
    runtimeSupport,
    parentUrl,
    specifierType,
    specifier,
  }) => {
    const context = {
      ...baseContext,
      isSupportedOnRuntime: (
        featureName,
        featureCompat = featuresCompatMap[featureName],
      ) => {
        return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
      },
      cookFile: async (params) => {
        const returnValue = await cookFile(params)
        // we are done with that subfile
        // restore currentContext to the current file
        currentContext = context
        return returnValue
      },
      parentUrl,
      specifierType,
      specifier,
    }
    currentContext = context

    context.resolve = async ({ parentUrl, specifierType, specifier }) => {
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
      let currentPlugin
      const contextDuringResolve = {
        ...context,
        parentUrl,
        specifierType,
        specifier,
        // when "resolve" is called during resolve hook
        // apply other plugin resolve hooks
        resolve: () => {
          pluginsToIgnore.push(currentPlugin)
          return callResolveHooks(
            plugins.filter((plugin) => !pluginsToIgnore.includes(plugin)),
          )
        },
      }
      const callResolveHooks = async (pluginsSubset) => {
        const resolveReturnValue = await findAsync({
          array: pluginsSubset,
          start: (plugin) => {
            currentPlugin = plugin
            return callPluginHook(plugin, "resolve", contextDuringResolve)
          },
          predicate: (returnValue) => Boolean(returnValue),
        })
        if (!resolveReturnValue) {
          return null
        }
        const url = String(resolveReturnValue)
        return url
      }
      return callResolveHooks(plugins)
    }

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
    context.url = await context.resolve({
      parentUrl,
      specifierType,
      specifier,
    })
    if (!context.url) {
      // TODO: use url trace to improve error message
      throw createNotFoundError({
        message: `"${specifier}" specifier found in "${parentUrl}" not resolved`,
      })
    }
    let urlMeta = {}
    plugins.forEach((plugin) => {
      const urlMetaFromPlugin = callPluginSyncHook(
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

    const loadReturnValue = await findAsync({
      array: plugins,
      start: (plugin) => callPluginHook(plugin, "load", context),
      predicate: (returnValue) => Boolean(returnValue),
    })
    if (!loadReturnValue) {
      throw createNotFoundError({
        message: `"${context.url}" cannot be loaded`,
      })
    }
    const {
      response,
      contentType = "application/octet-stream",
      content,
    } = loadReturnValue
    if (response) {
      context.response = response
      return context
    }
    context.contentType = contentType
    context.type = getRessourceType(context)
    context.content = content // can be a buffer (used for binary files) or a string
    if (context.contentType === "application/javascript") {
      const sourcemapSpecifier = getJavaScriptSourceMappingUrl(context.content)
      if (sourcemapSpecifier) {
        context.sourcemap = await loadSourcemap({
          parentUrl: context.url,
          specifierType: "js_sourcemap_comment",
          specifier: sourcemapSpecifier,
        })
      }
    } else if (context.contentType === "text/css") {
      const sourcemapSpecifier = getCssSourceMappingUrl(context.content)
      if (sourcemapSpecifier) {
        context.sourcemap = await loadSourcemap({
          parentUrl: context.url,
          specifierType: "css_sourcemap_comment",
          specifier: sourcemapSpecifier,
        })
      }
    }

    const updateContentAndSourcemap = ({ content, sourcemap }) => {
      context.content = content
      context.sourcemap = composeTwoSourcemaps(context.sourcemap, sourcemap)
    }

    const applyPluginReturnValue = (valueReturned, { hookName, plugin }) => {
      if (!valueReturned) {
        return
      }
      if (typeof valueReturned === "string" || Buffer.isBuffer(valueReturned)) {
        updateContentAndSourcemap({
          content: valueReturned,
        })
        return
      }
      if (typeof valueReturned === "object") {
        const { contentType, content, sourcemap } = valueReturned
        if (typeof content !== "string" && !Buffer.isBuffer(content)) {
          throw new Error(
            `Unexpected "content" found in plugin return value: it must be a string or a buffer
--- plugin name --- 
${plugin.name}
--- plugin hook ---
${hookName}
--- content ---
${content}`,
          )
        }
        if (contentType) {
          context.contentType = contentType
        }
        updateContentAndSourcemap({ content, sourcemap })
        return
      }
      throw new Error(
        `Unexpected value returned by plugin: it must be a string, a buffer or an object
--- plugin name --- 
${plugin.name}
--- plugin hook ---
${hookName}
--- value returned ---
${valueReturned}`,
      )
    }
    await plugins.reduce(async (previous, plugin) => {
      await previous
      const transformReturnValue = await callPluginHook(
        plugin,
        "transform",
        context,
      )
      applyPluginReturnValue(transformReturnValue, {
        plugin,
        hookName: "transform",
      })
    }, Promise.resolve())
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
      ressourceGraph.updateRessourceDependencies({
        url: context.url,
        type: context.type,
        dependencyUrls: urlMentions.map((urlMention) => urlMention.url),
        hotDecline,
        hotAcceptSelf,
        hotAcceptDependencies,
      })
      await plugins.reduce(async (previous, plugin) => {
        await previous
        const parsedReturnValue = await callPluginHook(
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
      await urlMentions.reduce(async (previous, urlMention) => {
        await previous
        const resolvedUrl = await context.resolve({
          parentUrl: context.url,
          specifierType: urlMention.type,
          specifier: urlMention.specifier,
        })
        urlMention.url = resolvedUrl
      }, Promise.resolve())
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
      updateContentAndSourcemap(transformReturnValue)
    } else {
      await onParsed({})
    }
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
    await findAsync({
      array: plugins,
      start: async (plugin) => {
        const renderReturnValue = await callPluginHook(
          plugin,
          "render",
          context,
        )
        if (!renderReturnValue) {
          return false
        }
        applyPluginReturnValue(renderReturnValue, {
          plugin,
          hookName: "render",
        })
        return true
      },
      predicate: (returnValue) => Boolean(returnValue),
    })
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
      content,
    })
    return context
  }
  const cookFile = async (params) => {
    try {
      return await _cookFile(params)
    } catch (e) {
      if (e.code === "NOT_FOUND") {
        // TODO: improve error message
        // - use context.parentUrl to say who imported that file
        // - use context.parentLine, parentColumn to eventually
        //   log where the ressource is referenced
        return {
          status: 404,
          statusText: e.message,
        }
      }
      if (e.code === "ENOENT") {
        return {
          status: 404,
          statusText: e.message,
        }
      }
      if (e.name === "SyntaxError") {
        // TODO: improve error message
        // - prefer a short, local file url if possible
        // - use context.parentUrl to say who imported that file
        // - introduce context.parentLine, parentColumn to further improve
        //   the url trace
        return {
          status: 500,
          statusText: `Syntax error while handling ${currentContext.url}`,
        }
      }
      throw e
    }
  }
  const loadSourcemap = async ({ parentUrl, specifierType, specifier }) => {
    const sourcemapContext = await cookFile({
      parentUrl,
      specifierType,
      specifier,
    })
    const sourcemap = JSON.parse(sourcemapContext.content)
    sourcemap.sources = sourcemap.sources.map((source) => {
      return new URL(source, sourcemapContext.url).href
    })
    return sourcemap
  }

  return {
    jsenvDirectoryUrl,
    cookFile,
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
  const outDirectoryUrl = resolveUrl(
    `.jsenv/${scenario}/${outDirectoryName}/`,
    projectDirectoryUrl,
  )
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
