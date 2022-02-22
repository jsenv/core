import { urlToContentType } from "@jsenv/server"

import { callPluginsHook } from "#internal/plugin_utils.js"
import { loadSourcemap } from "#internal/sourcemap/sourcemap_loader.js"
import { composeTwoSourcemaps } from "#internal/sourcemap/sourcemap_composition.js"
import { generateSourcemapUrl } from "#internal/sourcemap/sourcemap_utils.js"
import { injectSourcemap } from "#internal/sourcemap/sourcemap_injection.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  sourcemapInjectionMethod = "inline",
  plugins,
}) => {
  let context = {
    signal,
    logger,
  }
  const callHook = (hookName, params) =>
    callPluginsHook(plugins, hookName, {
      context,
      ...params,
    })
  context.callHook = callHook

  return async (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    context = {
      ...context,
      runtimeName,
      runtimeVersion,
    }
    try {
      const url = await callHook("resolve", {
        baseUrl: projectDirectoryUrl,
        urlSpecifier: request.ressource.slice(1),
      })
      if (!url) {
        return {
          status: 404,
        }
      }

      const loadResult = await callHook("load", {
        baseUrl: projectDirectoryUrl,
        url,
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

      const references = await callHook("parse", {
        url,
        contentType,
        content,
      })
      context.references = references

      const transformResult = await callHook("transform", {
        url,
        contentType,
        content,
      })
      if (transformResult) {
        content = transformResult.content
        let sourcemap = await loadSourcemap({
          context,
          url,
          contentType,
          content,
        })
        const sourcemapFromPlugin = transformResult.sourcemap
        if (sourcemap && sourcemapFromPlugin) {
          sourcemap = composeTwoSourcemaps(sourcemap, transformResult.sourcemap)
        } else if (sourcemapFromPlugin) {
          sourcemap = sourcemapFromPlugin
        }
        if (sourcemap) {
          content = injectSourcemap({
            url,
            contentType,
            content,
            sourcemap,
            sourcemapUrl: generateSourcemapUrl(url),
            sourcemapInjectionMethod,
          })
        }
      }
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
