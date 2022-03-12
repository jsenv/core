import { fetchFileSystem, serveDirectory } from "@jsenv/server"
import { urlIsInsideOf } from "@jsenv/filesystem"

import { moveUrl } from "@jsenv/core/src/utils/url_utils.js"

import { createKitchen } from "./kitchen/kitchen.js"
import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  plugins,
  sourcemapInjection,
  projectGraph,
  scenario,
  longTermCache = false, // will become true once things get more stable
}) => {
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins,
    sourcemapInjection,
    projectGraph,
  })
  return async (request) => {
    // serve file inside ".jsenv" directory
    const requestFileUrl = new URL(
      request.ressource.slice(1),
      projectDirectoryUrl,
    ).href
    if (urlIsInsideOf(requestFileUrl, kitchen.jsenvDirectoryUrl)) {
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
    const parentUrl = inferParentFromRequest(request, projectDirectoryUrl)
    const url = kitchen.resolveSpecifier({
      parentUrl,
      specifierType: "http_request",
      specifier: request.ressource,
    })
    const urlSite = projectGraph.inferUrlSite(url, parentUrl)
    const { response, error, contentType, content } = await kitchen.cookUrl({
      outDirectoryName: `${scenario}/${runtimeName}@${runtimeVersion}`,
      runtimeSupport,
      parentUrl,
      urlTrace: urlSite
        ? {
            type: "url_site",
            value: urlSite,
          }
        : null,
      url,
    })
    if (response) {
      return response
    }
    if (error) {
      if (
        error.name === "TRANSFORM_ERROR" &&
        error.cause.code === "PARSE_ERROR"
      ) {
        // let the browser re-throw the syntax error
        return {
          status: 200,
          statusText: error.reason,
          statusMessage: error.message,
          headers: {
            "content-type": contentType,
            "content-length": Buffer.byteLength(content),
            "cache-control": "no-store",
          },
          body: content,
        }
      }
      if (error.cause && error.cause.code === "EISDIR") {
        return serveDirectory(url, {
          headers: {
            accept: "text/html",
          },
          canReadDirectory: true,
          rootDirectoryUrl: projectDirectoryUrl,
        })
      }
      if (error.code === "NOT_ALLOWED") {
        return {
          status: 403,
          statusText: error.reason,
        }
      }
      if (error.code === "NOT_FOUND") {
        return {
          status: 404,
          statusText: error.reason,
          statusMessage: error.message,
        }
      }
      return {
        status: 500,
        statusText: error.reason,
        statusMessage: error.message,
      }
    }
    return {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length": Buffer.byteLength(content),
        "cache-control": determineCacheControlResponseHeader({
          url,
          longTermCache,
        }),
      },
      body: content,
    }
  }
}

const inferParentFromRequest = (request, projectDirectoryUrl) => {
  const { referer } = request.headers
  if (!referer) {
    return projectDirectoryUrl
  }
  return moveUrl(referer, request.origin, projectDirectoryUrl)
}

const determineCacheControlResponseHeader = ({ url, longTermCache }) => {
  const { searchParams } = new URL(url)
  // When url is versioned and no hmr on it, put it in browser cache for 30 days
  if (longTermCache && searchParams.has("v") && !searchParams.has("hmr")) {
    return `private,max-age=${SECONDS_IN_30_DAYS},immutable`
  }
  return `private,max-age=0,must-revalidate`
}
const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
