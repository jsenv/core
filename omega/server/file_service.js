import { urlToContentType } from "@jsenv/server"
import { urlIsInsideOf, writeFile, resolveUrl } from "@jsenv/filesystem"

import { moveUrl } from "#omega/internal/url_utils.js"
import { findAsync } from "#omega/internal/find_async.js"
import { loadSourcemap } from "#omega/internal/sourcemap/sourcemap_loader.js"
import { composeTwoSourcemaps } from "#omega/internal/sourcemap/sourcemap_composition.js"
import { generateSourcemapUrl } from "#omega/internal/sourcemap/sourcemap_utils.js"
import { injectSourcemap } from "#omega/internal/sourcemap/sourcemap_injection.js"
import { transformUrlMentions } from "#omega/url_mentions/url_mentions.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  sourcemapInjectionMethod = "inline",
  // https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/server/pluginContainer.ts
  plugins,
}) => {
  const contextBase = {
    signal,
    logger,
    projectDirectoryUrl,
    sourcemapInjectionMethod,
  }

  return async (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    const context = {
      ...contextBase,
      runtimeName,
      runtimeVersion,
    }
    plugins = plugins.filter((plugin) => {
      return !plugin.shouldSkip || !plugin.shouldSkip(context)
    })
    // TODO: memoize by url + baseUrl + urlResolutionMethod
    context.resolve = async ({
      urlResolutionMethod = "url",
      baseUrl,
      urlSpecifier,
    }) => {
      const url = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.resolve) {
            return plugin.resolve({
              ...context,
              urlResolutionMethod,
              baseUrl,
              urlSpecifier,
            })
          }
          return null
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      return url || resolveUrl(urlSpecifier, baseUrl)
    }

    try {
      context.baseUrl = projectDirectoryUrl
      context.urlSpecifier = request.ressource.slice(1)
      context.url = await context.resolve(context)
      context.contentType = urlToContentType(context.url)
      const loadResult = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.load) {
            return plugin.load(context)
          }
          return null
        },
        predicate: (returnValue) => Boolean(returnValue),
      })
      if (!loadResult) {
        return {
          status: 404,
        }
      }
      context.content = loadResult.content // can be a buffer (used for binary files) or a string
      context.contentType = loadResult.contentType || context.contentType
      context.sourcemap = await loadSourcemap(context)
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
        const { transform } = plugin
        if (!transform) {
          return
        }
        const transformReturnValue = await transform(context)
        mutateContentAndSourcemap(transformReturnValue)
      }, Promise.resolve())
      const transformUrlMentionsReturnValue = await transformUrlMentions(
        context,
      )
      mutateContentAndSourcemap(transformUrlMentionsReturnValue)

      if (context.sourcemap) {
        context.sourcemapUrl = generateSourcemapUrl(context.url)
        context.content = injectSourcemap(context)
        writeIntoRuntimeDirectory({
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

// this is just for debug (ability to see what is generated)
const writeIntoRuntimeDirectory = ({
  projectDirectoryUrl,
  runtimeName,
  runtimeVersion,
  url,
  content,
}) => {
  if (!urlIsInsideOf(url, projectDirectoryUrl)) {
    return
  }
  const outDirectoryUrl = resolveUrl(
    `.jsenv/${runtimeName}@${runtimeVersion}`,
    projectDirectoryUrl,
  )
  writeFile(moveUrl(url, projectDirectoryUrl, outDirectoryUrl), content)
}
