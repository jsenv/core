import { fetchFileSystem, urlToContentType } from "@jsenv/server"
import { urlIsInsideOf, writeFile, resolveUrl } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { moveUrl } from "#omega/internal/url_utils.js"
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
  ressourceGraph,
  scenario,
  sourcemapInjection,
  // https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/server/pluginContainer.ts
  plugins,
}) => {
  const urlInfoMap = new Map()
  // const urlRedirections = {}
  const baseContext = {
    signal,
    logger,
    projectDirectoryUrl,
    ressourceGraph,
    scenario,
    sourcemapInjection,
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
      context.getUrlFacade = (url) => {
        const urlInfo = urlInfoMap.get(url)
        return urlInfo.urlFacade || url
      }
      context.url = await context.resolve({
        parentUrl,
        specifierType,
        specifier,
      })
      if (!context.url) {
        context.error = createFileNotFoundError(
          `"${specifier}" specifier found in "${parentUrl}" not resolved`,
        )
        return context
      }
      Object.assign(context, urlInfoMap.get(context.url))
      context.urlFacade = context.getUrlFacade(context.url)
      context.contentType = urlToContentType(context.urlFacade)
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
        context.error = createFileNotFoundError(
          `"${parentUrl}" cannot be loaded`,
        )
        return context
      }
      context.content = loadReturnValue.content // can be a buffer (used for binary files) or a string
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
      const { error, url, content } = await cookFile({
        parentUrl,
        specifierType,
        specifier,
      })
      if (error) {
        logger.warn(
          createDetailedMessage(`Error while handling sourcemap`, {
            "error message": error.message,
            "sourcemap url": url,
            "referenced by": parentUrl,
          }),
        )
        return null
      }
      const sourcemapString = content
      try {
        return JSON.parse(sourcemapString)
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
    const { error, urlFacade, contentType, content, sourcemapUrl, sourcemap } =
      await cookFile({
        parentUrl: projectDirectoryUrl,
        specifierType: "http_request",
        specifier: request.ressource,
      })
    if (error && error.code === "FILE_NOT_FOUND") {
      return {
        status: 404,
      }
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

const createFileNotFoundError = (message) => {
  const error = new Error(message)
  error.code = "FILE_NOT_FOUND"
  return error
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
