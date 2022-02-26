import { fetchFileSystem, urlToContentType } from "@jsenv/server"
import { urlIsInsideOf, writeFile, resolveUrl } from "@jsenv/filesystem"

import { moveUrl } from "#omega/internal/url_utils.js"
import { findAsync } from "#omega/internal/find_async.js"
import { loadSourcemap } from "#omega/internal/sourcemap/sourcemap_loader.js"
import { composeTwoSourcemaps } from "#omega/internal/sourcemap/sourcemap_composition.js"
import { generateSourcemapUrl } from "#omega/internal/sourcemap/sourcemap_utils.js"
import { injectSourcemap } from "#omega/internal/sourcemap/sourcemap_injection.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  ressourceGraph,
  scenario,
  sourcemapInjectionMethod = "inline",
  // https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/server/pluginContainer.ts
  plugins,
}) => {
  const urlInfoMap = new Map()
  // const urlRedirections = {}
  const contextBase = {
    signal,
    logger,
    projectDirectoryUrl,
    ressourceGraph,
    scenario,
    sourcemapInjectionMethod,
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
    const context = {
      ...contextBase,
      runtimeName,
      runtimeVersion,
      runtimeSupport,
    }
    plugins = plugins.filter((plugin) => {
      return plugin.appliesDuring && plugin.appliesDuring[scenario]
    })
    context.resolve = async ({
      parentUrl,
      specifierType = "url",
      specifier,
    }) => {
      const resolveReturnValue = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.resolve) {
            return plugin.resolve({
              ...context,
              parentUrl,
              specifierType,
              specifier,
            })
          }
          return null
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (resolveReturnValue) {
        if (typeof resolveReturnValue === "object") {
          const { url, ...urlInfo } = resolveReturnValue
          urlInfoMap.set(url, urlInfo)
          return url
        }
        urlInfoMap.set(resolveReturnValue, {})
        return resolveReturnValue
      }
      return null
    }

    try {
      context.parentUrl = projectDirectoryUrl
      context.specifier = request.ressource.slice(1)
      context.url = await context.resolve({
        parentUrl: projectDirectoryUrl,
        specifierType: "http_request",
        specifier: context.specifier,
      })
      Object.assign(context, urlInfoMap.get(context.url))
      context.contentType = urlToContentType(context.urlFacade || context.url)
      const loadReturnValue = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.load) {
            return plugin.load(context)
          }
          return null
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (!loadReturnValue) {
        return {
          status: 404,
        }
      }
      // if (loadReturnValue.url) {
      //   // url can be redirected during load
      //   // (magic extensions for example)
      //   urlRedirections[context.url] = loadReturnValue.url
      //   context.url = loadReturnValue.url
      // }
      context.content = loadReturnValue.content // can be a buffer (used for binary files) or a string
      context.sourcemap = await loadSourcemap(context)
      let finalize
      const mutateContentAndSourcemap = (transformReturnValue) => {
        if (!transformReturnValue) {
          return
        }
        context.content = transformReturnValue.content
        context.sourcemap = composeTwoSourcemaps(
          context.sourcemap,
          transformReturnValue.sourcemap,
        )
        finalize = transformReturnValue.finalize
      }
      await plugins.reduce(async (previous, plugin) => {
        await previous
        const { transform } = plugin
        if (!transform) {
          return
        }
        const transformReturnValue = await transform(context)
        mutateContentAndSourcemap(transformReturnValue)
      }, Promise.resolve())
      if (finalize) {
        const finalizeReturnValue = await finalize(context)
        mutateContentAndSourcemap(finalizeReturnValue)
      }

      if (context.sourcemap) {
        context.sourcemapUrl = generateSourcemapUrl(context.url)
        context.content = injectSourcemap(context)
        await writeIntoRuntimeDirectory({
          ...context,
          url: context.sourcemapUrl,
          content: JSON.stringify(context.sourcemap, null, "  "),
        })
      }
      writeIntoRuntimeDirectory(context)

      return {
        status: 200,
        headers: {
          "content-type": context.contentType,
          "content-length": Buffer.byteLength(context.content),
        },
        body: context.content,
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        return {
          status: 404,
        }
      }
      if (e.asResponse) {
        return e.asResponse()
      }
      throw e
    }
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
