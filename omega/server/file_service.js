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
  let context = {
    signal,
    logger,
    projectDirectoryUrl,
  }

  return async (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    context = {
      ...context,
      runtimeName,
      runtimeVersion,
    }
    plugins = plugins.filter((plugin) => {
      return !plugin.shouldSkip(context)
    })
    // TODO: memoize by url + baseUrl + type
    context.resolve = async ({ baseUrl, urlSpecifier, type = "url" }) => {
      const url = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.resolve) {
            return plugin.resolve({
              ...context,
              baseUrl,
              type,
              urlSpecifier,
            })
          }
          return null
        },
        predicate: (returnValue) =>
          returnValue !== null && returnValue !== undefined,
      })
      return url || resolveUrl(urlSpecifier, baseUrl)
    }

    try {
      const url = await context.resolve({
        baseUrl: projectDirectoryUrl,
        urlSpecifier: request.ressource.slice(1),
      })
      const loadResult = await findAsync({
        array: plugins,
        start: (plugin) => {
          if (plugin.load) {
            return plugin.load({
              ...context,
              baseUrl: projectDirectoryUrl,
              url,
            })
          }
          return null
        },
        predicate: (returnValue) =>
          returnValue !== null && returnValue !== undefined,
      })
      if (loadResult === null) {
        return {
          status: 404,
        }
      }
      let {
        contentType = urlToContentType(url),
        // can be a buffer (used for binary files) or a string
        content,
      } = loadResult
      let sourcemap = await loadSourcemap({
        context,
        url,
        contentType,
        content,
      })
      const mutateContentAndSourcemap = (transformReturnValue) => {
        if (!transformReturnValue) {
          return
        }
        content = transformReturnValue.content
        sourcemap = composeTwoSourcemaps(
          sourcemap,
          transformReturnValue.sourcemap,
        )
      }

      await plugins.reduce(async (previous, plugin) => {
        await previous
        const { transform } = plugin
        if (!transform) {
          return
        }
        const transformReturnValue = await transform({
          ...context,
          contentType,
          content,
        })
        mutateContentAndSourcemap(transformReturnValue)
      }, Promise.resolve())
      const transformUrlMentionsReturnValue = await transformUrlMentions({
        projectDirectoryUrl,
        resolve: context.resolve,
        url,
        contentType,
        content,
      })
      mutateContentAndSourcemap(transformUrlMentionsReturnValue)

      if (sourcemap) {
        const sourcemapUrl = generateSourcemapUrl(url)
        content = injectSourcemap({
          url,
          contentType,
          content,
          sourcemap,
          sourcemapUrl,
          sourcemapInjectionMethod,
        })
        writeIntoRuntimeDirectory({
          projectDirectoryUrl,
          runtimeName,
          runtimeVersion,
          url: sourcemapUrl,
          content: JSON.stringify(sourcemap, null, "  "),
        })
      }
      writeIntoRuntimeDirectory({
        projectDirectoryUrl,
        runtimeName,
        runtimeVersion,
        url,
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
