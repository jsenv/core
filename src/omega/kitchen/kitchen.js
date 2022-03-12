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
import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"

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
  plugins,
  sourcemapInjection,
  projectGraph,
  scenario,
  urlMentionHandlers = {},
}) => {
  urlMentionHandlers = {
    ...urlMentionHandlers,
    js_import_meta_url_pattern: (urlMention, { asClientUrl }) => {
      return JSON.stringify(asClientUrl(urlMention.url))
    },
    js_import_export: (urlMention, { asClientUrl }) => {
      return JSON.stringify(asClientUrl(urlMention.url))
    },
  }
  plugins = [
    ...plugins,
    ...getJsenvPlugins({
      projectDirectoryUrl,
    }),
  ]
  plugins = flattenAndFilterPlugins(plugins, {
    scenario,
  })

  const baseContext = {
    signal,
    logger,
    projectDirectoryUrl,
    plugins,
    sourcemapInjection,
    projectGraph,
    scenario,
    urlMentionHandlers,
  }
  const jsenvDirectoryUrl = new URL(".jsenv/", projectDirectoryUrl).href
  const pluginController = createPluginController()
  let currentContext

  const isSupported = ({
    runtimeSupport,
    featureName,
    featureCompat = featuresCompatMap[featureName],
  }) => {
    return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
  }

  const resolveSpecifier = ({ parentUrl, specifierType, specifier }) => {
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
      // when "resolveSpecifier" is called during resolve hook
      // apply other plugin resolve hooks
      resolveSpecifier: () => {
        pluginsToIgnore.push(pluginController.getCurrentPlugin())
        return callResolveHooks(
          plugins.filter((plugin) => !pluginsToIgnore.includes(plugin)),
        )
      },
    }
    const callResolveHooks = (pluginsSubset) => {
      for (const plugin of pluginsSubset) {
        const resolveReturnValue = pluginController.callPluginSyncHook(
          plugin,
          "resolve",
          contextDuringResolve,
        )
        if (resolveReturnValue) {
          return resolveReturnValue
        }
      }
      return null
    }
    contextDuringResolve.url = callResolveHooks(plugins)
    if (contextDuringResolve.url) {
      plugins.forEach((plugin) => {
        const redirectReturnValue = pluginController.callPluginSyncHook(
          plugin,
          "redirect",
          contextDuringResolve,
        )
        if (redirectReturnValue) {
          contextDuringResolve.url = redirectReturnValue
        }
      })
    }
    return contextDuringResolve.url
  }

  const getOriginalUrlSite = async ({ url, line, column }) => {
    const { parentUrlSite, originalContent, content, sourcemap, generatedUrl } =
      currentContext
    const adjustIfInline = ({ url, line, column, content }) => {
      if (parentUrlSite) {
        return {
          url: parentUrlSite.url,
          // <script>console.log('ok')</script> remove 1 because code starts on same line as script tag
          line: parentUrlSite.line + line - 1,
          column: parentUrlSite.column + column,
          content: parentUrlSite.content,
        }
      }
      return {
        url,
        line,
        column,
        content,
      }
    }
    if (content === originalContent) {
      return adjustIfInline({
        url,
        line,
        column,
        content: originalContent,
      })
    }
    if (!sourcemap) {
      return {
        url: generatedUrl,
        line,
        column,
        content,
      }
    }
    const originalPosition = await getOriginalPosition({
      sourcemap,
      line,
      column,
    })
    // cannot map back to original file
    if (!originalPosition || originalPosition.line === null) {
      return {
        url: generatedUrl,
        line,
        column,
        content,
      }
    }
    return adjustIfInline({
      url,
      line: originalPosition.line,
      column: originalPosition.column,
      content: originalContent,
    })
  }

  const getParamsForUrlTracing = async () => {
    const { url, urlTrace } = currentContext
    if (urlTrace.type === "url_string") {
      urlTrace.value = await getOriginalPosition(urlTrace.value)
    }
    return {
      urlTrace,
      url,
    }
  }

  const _cookUrl = async ({
    outDirectoryName,
    runtimeSupport,
    parentUrl,
    urlTrace,
    url,
  }) => {
    const context = {
      ...baseContext,
      resolveSpecifier,
      cookUrl: async ({ parentUrl, urlTrace, url }) => {
        const returnValue = await cookUrl({
          outDirectoryName,
          runtimeSupport,
          parentUrl,
          urlTrace,
          url,
        })
        // we are done with that subfile
        // restore currentContext to the current file
        currentContext = context
        return returnValue
      },
      isSupportedOnRuntime: (featureName, featureCompat) => {
        return isSupported({ runtimeSupport, featureName, featureCompat })
      },
      parentUrl,
      urlTrace,
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
    context.resolveUrlMention = (urlMention) => {
      const handler =
        urlMentionHandlers[urlMention.type] || urlMentionHandlers["*"]
      return (
        handler(urlMention, currentContext) ||
        context.asClientUrl(urlMention.url)
      )
    }
    // TODO: make it a hook in itself like "resolveClientUrl" handled by plugin
    // the autoreload plugin will handle the hmr part
    // the url versioning the v in url part
    // the filesystem the /@fs/ ?
    context.asClientUrl = (url) => {
      const clientUrlRaw = url
      const urlInfo = projectGraph.getUrlInfo(url) || {}
      const params = {}
      if (context.hmr && urlInfo.hmrTimestamp) {
        params.hmr = ""
        params.v = urlInfo.hmrTimestamp
      } else if (urlInfo.version) {
        params.v = urlInfo.version
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
        parentUrlSite,
      } = loadReturnValue
      if (response) {
        context.response = response
        return context
      }
      context.contentType = contentType
      context.type = getRessourceType(context)
      context.originalContent = content
      context.content = content
      context.parentUrlSite = parentUrlSite
    } catch (error) {
      context.error = createLoadError({
        pluginController,
        ...(await getParamsForUrlTracing()),
        error,
      })
      return context
    }
    context.generatedUrl = determineFileUrlForOutDirectory({
      projectDirectoryUrl,
      outDirectoryName,
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
        ...(await getParamsForUrlTracing()),
        type: currentContext.type,
        error,
      })
      return context
    }

    // parsing
    const parser = parsers[context.type]
    const {
      urlMentions = [],
      getHotInfo = () => ({}),
      transformUrlMentions,
    } = parser ? await parser(context) : {}
    const dependencyUrls = []
    const dependencyUrlSites = {}
    for (const urlMention of urlMentions) {
      const specifierUrlSite =
        context.content === context.originalContent ||
        typeof urlMention.originalLine === "number"
          ? {
              url,
              line: urlMention.originalLine,
              column: urlMention.originalColumn,
            }
          : {
              url: context.generatedUrl,
              line: urlMention.line,
              column: urlMention.column,
            }
      try {
        const resolvedUrl = resolveSpecifier({
          parentUrl: context.url,
          specifierType: urlMention.type,
          specifier: urlMention.specifier,
        })
        if (resolvedUrl === null) {
          throw new Error(`NO_RESOLVE`)
        }
        urlMention.url = resolvedUrl
        dependencyUrls.push(resolvedUrl)
        dependencyUrlSites[resolvedUrl] = specifierUrlSite
      } catch (error) {
        context.error = createResolveError({
          pluginController,
          specifierTrace: {
            type: "url_site",
            value: await getOriginalUrlSite(specifierUrlSite),
          },
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
    projectGraph.updateUrlInfo({
      url: context.url,
      generatedUrl: context.generatedUrl,
      type: context.type,
      contentType: context.contentType,
      originalContent: context.originalContent,
      content: context.content,
      sourcemap: context.sourcemap,
      parentUrlSite: context.parentUrlSite,
      dependencyUrls,
      hotDecline,
      hotAcceptSelf,
      hotAcceptDependencies,
    })
    // "dependencyResolved" hook
    await pluginController.callPluginHooksUntil(
      plugins,
      "dependencyResolved",
      context,
    )
    if (transformUrlMentions) {
      const transformReturnValue = await transformUrlMentions()
      updateContents(transformReturnValue)
    }

    // sourcemap injection
    const { sourcemap } = context
    if (sourcemap) {
      const sourcemapUrl = generateSourcemapUrl(context.url)
      const sourcemapGeneratedUrl = determineFileUrlForOutDirectory({
        projectDirectoryUrl,
        outDirectoryName,
        url: sourcemapUrl,
      })
      context.sourcemapGeneratedUrl = sourcemapGeneratedUrl
      context.content = injectSourcemap(context)
    }

    // "finalize" hook
    const finalizeReturnValue = await pluginController.callPluginHooksUntil(
      plugins,
      "finalize",
      context,
    )
    updateContents(finalizeReturnValue)

    // "cooked" hook
    plugins.forEach((plugin) => {
      const cookedReturnValue = pluginController.callPluginSyncHook(
        plugin,
        "cooked",
        context,
      )
      if (typeof cookedReturnValue === "function") {
        const removePrunedCallback = projectGraph.prunedCallbackList.add(
          (prunedUrlInfo) => {
            if (prunedUrlInfo.url === context.url) {
              removePrunedCallback()
              cookedReturnValue()
            }
          },
        )
      }
    })

    return context
  }
  const cookUrl = async (params) => {
    try {
      const context = await _cookUrl(params)
      const { generatedUrl } = context
      // writing result inside ".jsenv" directory (debug purposes)
      if (generatedUrl && generatedUrl.startsWith("file:")) {
        writeFile(generatedUrl, context.content)
        const { sourcemapGeneratedUrl, sourcemap } = context
        if (sourcemapGeneratedUrl && sourcemap) {
          if (sourcemapInjection === "comment") {
            await writeFile(
              sourcemapGeneratedUrl,
              JSON.stringify(sourcemap, null, "  "),
            )
          } else if (sourcemapInjection === "inline") {
            writeFile(
              sourcemapGeneratedUrl,
              JSON.stringify(sourcemap, null, "  "),
            )
          }
        }
      }
      return context
    } catch (e) {
      throw e
    }
  }
  const loadSourcemap = async ({ parentUrl, specifierType, specifier }) => {
    const sourcemapUrl = resolveSpecifier({
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
    isSupported,
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
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("js_classic")) {
      return "js_classic"
    }
    if (urlObject.searchParams.has("worker_classic")) {
      return "worker_classic"
    }
    if (urlObject.searchParams.has("worker_module")) {
      return "worker_module"
    }
    if (urlObject.searchParams.has("service_worker_classic")) {
      return "service_worker_classic"
    }
    if (urlObject.searchParams.has("service_worker_module")) {
      return "service_worker_module"
    }
    return "js_module"
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
  url,
}) => {
  if (!url.startsWith("file:")) {
    return url
  }
  if (!urlIsInsideOf(url, projectDirectoryUrl)) {
    url = `${projectDirectoryUrl}@fs/${url.slice(filesystemRootUrl.length)}`
  }
  const outDirectoryUrl = new URL(
    `.jsenv/${outDirectoryName}/`,
    projectDirectoryUrl,
  ).href
  return moveUrl(url, projectDirectoryUrl, outDirectoryUrl)
}
