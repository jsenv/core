import { fetchFileSystem, urlToContentType } from "@jsenv/server"
import {
  urlIsInsideOf,
  writeFile,
  resolveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { moveUrl, injectQueryParams } from "#omega/internal/url_utils.js"
import { findAsync } from "#omega/internal/find_async.js"
import {
  getCssSourceMappingUrl,
  getJavaScriptSourceMappingUrl,
  generateSourcemapUrl,
} from "#omega/internal/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "#omega/internal/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "#omega/internal/sourcemap/sourcemap_injection.js"

import { parseUserAgentHeader } from "./user_agent.js"

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
  // const urlRedirections = {}
  const baseContext = {
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    sourcemapInjection,
    ressourceGraph,
    urlInfoMap,
    // urlRedirections,
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
      runtimeName,
      runtimeVersion,
      runtimeSupport,
    }
    plugins = plugins.filter((plugin) => {
      return plugin.appliesDuring && plugin.appliesDuring[scenario]
    })
    const responseFromPlugin = await findAsync({
      array: plugins,
      start: (plugin) => {
        return callPluginHook(plugin, "serve", {
          projectDirectoryUrl,
          request,
        })
      },
      predicate: (returnValue) => Boolean(returnValue),
    })
    if (responseFromPlugin) {
      return responseFromPlugin
    }

    const cookFile = async ({ parentUrl, specifierType, specifier }) => {
      const context = {
        ...baseContext,
        ...requestContext,
        parentUrl,
        specifierType,
        specifier,
      }
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
        context.response = {
          status: 404,
          statusText: `"${specifier}" specifier found in "${parentUrl}" not resolved`,
        }
        return context
      }
      const urlInfo = urlInfoMap.get(context.url)
      Object.assign(context, urlInfo)
      context.urlFacade = urlInfo.urlFacade || context.url
      // for (const plugin of plugins) {
      //   const redirectReturnValue = plugin.redirect(context)
      //   if (redirectReturnValue) {
      //     // on aura besoin de gérer ces redirections
      //     context.urlFacade = redirectReturnValue
      //     break
      //   }
      // }
      context.contentType = urlToContentType(context.urlFacade)
      const loadReturnValue = await findAsync({
        array: plugins,
        start: (plugin) => {
          return callPluginHook(plugin, "load", context)
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (!loadReturnValue) {
        context.response = {
          status: 404,
          statusText: `"${parentUrl}" cannot be loaded`,
        }
        return context
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
        context.content = transformReturnValue.content
        context.sourcemap = composeTwoSourcemaps(
          context.sourcemap,
          transformReturnValue.sourcemap,
        )
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
      const { response, url, content } = await cookFile({
        parentUrl,
        specifierType,
        specifier,
      })
      if (response && response.status === 404) {
        logger.warn(
          createDetailedMessage(`Error while handling sourcemap`, {
            "error message": response.statusText,
            "sourcemap url": url,
            "referenced by": parentUrl,
          }),
        )
        return null
      }
      const sourcemapString = content
      try {
        const sourcemap = JSON.parse(sourcemapString)
        sourcemap.sources = sourcemap.sources.map((source) => {
          return new URL(source, url).href
        })
        return sourcemap
      } catch (e) {
        if (e.name === "SyntaxError") {
          logger.error(
            createDetailedMessage(`syntax error while parsing sourcemap`, {
              "syntax error stack": e.stack,
              "sourcemap url": url,
              "referenced by": parentUrl,
            }),
          )
          return null
        }
        throw e
      }
    }
    const {
      response,
      urlFacade,
      contentType,
      content,
      sourcemapUrl,
      sourcemap,
    } = await cookFile({
      parentUrl: projectDirectoryUrl,
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
  }
}

const callPluginHook = async (plugin, hookName, params) => {
  const hook = plugin[hookName]
  if (!hook) {
    return null
  }
  try {
    return await plugin[hookName](params)
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
