import { fetchFileSystem, urlToContentType } from "@jsenv/server"
import {
  urlIsInsideOf,
  writeFile,
  resolveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { moveUrl, injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"
import { findAsync } from "@jsenv/core/src/utils/find_async.js"
import {
  getCssSourceMappingUrl,
  getJavaScriptSourceMappingUrl,
  generateSourcemapUrl,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"

import { featuresCompatMap } from "./runtime_support/features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "./runtime_support/runtime_support.js"
import { parseUserAgentHeader } from "./user_agent.js"
import { parseHtmlUrlMentions } from "./parse/html/html_url_mentions.js"
import { parseCssUrlMentions } from "./parse/css/css_url_mentions.js"
import { parseJsModuleUrlMentions } from "./parse/js_module/js_module_url_mentions.js"
import { createNotFoundError } from "./errors.js"

const parsers = {
  html: parseHtmlUrlMentions,
  css: parseCssUrlMentions,
  js_module: parseJsModuleUrlMentions,
}

export const createFileService = ({
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
    urlInfoMap,
  }
  const jsenvDirectoryUrl = new URL(".jsenv/", projectDirectoryUrl).href
  return async (request) => {
    // serve file inside ".jsenv" directory
    const requestFileUrl = new URL(
      request.ressource.slice(1),
      projectDirectoryUrl,
    ).href
    if (urlIsInsideOf(requestFileUrl, jsenvDirectoryUrl)) {
      return fetchFileSystem(requestFileUrl, {
        headers: request.headers,
      })
    }

    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    const runtimeSupport = {
      [runtimeName]: runtimeVersion,
    }
    const requestContext = {
      request,
      isSupportedOnRuntime: (
        featureName,
        featureCompat = featuresCompatMap[featureName],
      ) => {
        return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
      },
      runtimeSupport,
    }

    let currentContext
    const cookFile = async ({ parentUrl, specifierType, specifier }) => {
      const context = {
        ...baseContext,
        ...requestContext,
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
        const resolveReturnValue = await findAsync({
          array: plugins,
          start: (plugin) => {
            return callPluginHook(plugin, "resolve", {
              ...context,
              parentUrl,
              specifierType,
              specifier,
            })
          },
          predicate: (returnValue) => Boolean(returnValue),
        })
        if (!resolveReturnValue) {
          return null
        }
        if (typeof resolveReturnValue === "object") {
          const { url, ...urlInfo } = resolveReturnValue
          urlInfoMap.set(url, urlInfo)
          return url
        }
        const url = String(resolveReturnValue)
        urlInfoMap.set(url, {})
        return url
      }
      context.asClientUrl = (url, parentUrl) => {
        const hmr = new URL(parentUrl).searchParams.get("hmr")
        const urlInfo = urlInfoMap.get(url) || {}
        const { urlFacade, urlVersion } = urlInfo
        const clientUrlRaw = urlFacade || url
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
        return clientUrl
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
      const urlInfo = urlInfoMap.get(context.url)
      Object.assign(context, urlInfo)
      context.urlFacade = urlInfo.urlFacade || context.url
      context.contentType = urlToContentType(context.urlFacade)
      context.type = getRessourceType(context)
      const loadReturnValue = await findAsync({
        array: plugins,
        start: (plugin) => {
          return callPluginHook(plugin, "load", context)
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (!loadReturnValue) {
        throw createNotFoundError({
          message: `"${context.url}" cannot be loaded`,
        })
      }
      const { response, content } = loadReturnValue
      if (response) {
        context.response = response
        return context
      }
      context.content = content // can be a buffer (used for binary files) or a string
      if (context.contentType === "application/javascript") {
        const sourcemapSpecifier = getJavaScriptSourceMappingUrl(
          context.content,
        )
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

      const mutateContentAndSourcemap = (transformReturnValue) => {
        if (!transformReturnValue) {
          return
        }
        if (typeof transformReturnValue === "string") {
          context.content = transformReturnValue
          // put a warning for css and js because it prevent sourcemap?
        } else {
          context.content = transformReturnValue.content
          context.sourcemap = composeTwoSourcemaps(
            context.sourcemap,
            transformReturnValue.sourcemap,
          )
        }
      }
      await plugins.reduce(async (previous, plugin) => {
        await previous
        const transformReturnValue = await callPluginHook(
          plugin,
          "transform",
          context,
        )
        mutateContentAndSourcemap(transformReturnValue)
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
        mutateContentAndSourcemap(transformReturnValue)
      } else {
        await onParsed({})
      }

      const { sourcemap } = context
      if (sourcemap && sourcemapInjection === "comment") {
        const sourcemapUrl = generateSourcemapUrl(context.urlFacade)
        const sourcemapOutUrl = determineFileUrlForOutDirectory({
          projectDirectoryUrl,
          scenario,
          runtimeName,
          runtimeVersion,
          url: sourcemapUrl,
        })
        context.sourcemapUrl = sourcemapOutUrl
        context.content = injectSourcemap(context)
      } else if (sourcemap && sourcemapInjection === "inline") {
        context.sourcemapUrl = generateSourcemapUrl(context.urlFacade)
        context.content = injectSourcemap(context)
      }
      return context
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
    try {
      const {
        response,
        urlFacade,
        contentType,
        content,
        sourcemapUrl,
        sourcemap,
      } = await cookFile({
        parentUrl: String(projectDirectoryUrl),
        specifierType: "http_request",
        specifier: request.ressource,
      })
      if (response) {
        return response
      }
      if (sourcemapUrl) {
        writeIntoRuntimeDirectory({
          projectDirectoryUrl,
          scenario,
          runtimeName,
          runtimeVersion,
          url: sourcemapUrl,
          content: JSON.stringify(sourcemap, null, "  "),
        })
      }
      writeIntoRuntimeDirectory({
        projectDirectoryUrl,
        scenario,
        runtimeName,
        runtimeVersion,
        url: urlFacade,
        content,
      })
      return {
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(content),
        },
        body: content,
      }
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

const callPluginHook = async (plugin, hookName, params) => {
  let hook = plugin[hookName]
  if (!hook) {
    return null
  }
  if (typeof hook === "object") {
    hook = hook[hookName === "resolve" ? params.specifierType : params.type]
    if (!hook) {
      return null
    }
  }
  try {
    return await hook(params)
  } catch (e) {
    if (e && e.asResponse) {
      throw e
    }
    if (e && e.statusText === "Unexpected directory operation") {
      e.asResponse = () => {
        return {
          status: 403,
        }
      }
      throw e
    }
    throw e
  }
}

const determineFileUrlForOutDirectory = ({
  projectDirectoryUrl,
  scenario,
  runtimeName,
  runtimeVersion,
  url,
}) => {
  const outDirectoryUrl = resolveUrl(
    `.jsenv/${scenario}/${runtimeName}@${runtimeVersion}/`,
    projectDirectoryUrl,
  )
  return moveUrl(url, projectDirectoryUrl, outDirectoryUrl)
}

// this is just for debug (ability to see what is generated)
const writeIntoRuntimeDirectory = async ({
  projectDirectoryUrl,
  scenario,
  runtimeName,
  runtimeVersion,
  url,
  content,
}) => {
  if (!urlIsInsideOf(url, projectDirectoryUrl)) {
    return
  }
  await writeFile(
    determineFileUrlForOutDirectory({
      projectDirectoryUrl,
      scenario,
      runtimeName,
      runtimeVersion,
      url,
    }),
    content,
  )
}
