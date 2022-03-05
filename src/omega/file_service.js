import { fetchFileSystem } from "@jsenv/server"
import { urlIsInsideOf } from "@jsenv/filesystem"

import { createKitchen } from "./kitchen/kitchen.js"
import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logger,
  projectDirectoryUrl,
  scenario,
  plugins,
  sourcemapInjection,
  ressourceGraph,
  longTermCache = false, // will become true once things get more stable
}) => {
  const kitchen = createKitchen({
    signal,
    logger,
    projectDirectoryUrl,
    scenario,
    plugins,
    sourcemapInjection,
    ressourceGraph,
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
    const { response, url, contentType, content } = await kitchen.cookFile({
      outDirectoryName: `${runtimeName}@${runtimeVersion}`,
      runtimeSupport,
      parentUrl: projectDirectoryUrl,
      specifierType: "http_request",
      specifier: request.ressource,
    })
    if (response) {
      return response
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

const determineCacheControlResponseHeader = ({ url, longTermCache }) => {
  const { searchParams } = new URL(url)
  // When url is versioned and no hmr on it, put it in browser cache for 30 days
  if (longTermCache && searchParams.has("v") && !searchParams.has("hmr")) {
    return `private,max-age=${SECONDS_IN_30_DAYS},immutable`
  }
  return `private,max-age=0,must-revalidate`
}
const SECONDS_IN_30_DAYS = 60 * 60 * 24 * 30
