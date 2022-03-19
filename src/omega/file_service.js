import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { urlIsInsideOf, urlToExtension } from "@jsenv/filesystem"

import { moveUrl, setUrlExtension } from "@jsenv/core/src/utils/url_utils.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  projectDirectoryUrl,
  urlGraph,
  pluginController,
  kitchen,
  scenario,
}) => {
  const serveContext = {
    rootDirectoryUrl: projectDirectoryUrl,
    urlGraph,
    scenario,
  }

  const getResponse = async (request) => {
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
    const responseFromPlugin = pluginController.callHooksUntil(
      "serve",
      request,
      serveContext,
    )
    if (responseFromPlugin) {
      return responseFromPlugin
    }
    if (urlToExtension(requestFileUrl) === ".map") {
      const urlWithoutMapExtension = setUrlExtension(requestFileUrl, "")
      const urlInfo = urlGraph.getUrlInfo(urlWithoutMapExtension)
      if (urlInfo && urlInfo.sourcemap) {
        const json = JSON.stringify(urlInfo.sourcemap)
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(json),
          },
          body: json,
        }
      }
    }

    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    const runtimeSupport = {
      [runtimeName]: runtimeVersion,
    }
    const reference = kitchen.createReference({
      parentUrl: inferParentFromRequest(request, projectDirectoryUrl),
      type: "entry_point",
      specifier: request.ressource,
    })
    const requestedUrlInfo = kitchen.resolveReference(reference)
    const referenceFromGraph = urlGraph.inferReference(
      reference.url,
      reference.parentUrl,
    )
    try {
      await kitchen.cook({
        reference: referenceFromGraph || reference,
        urlInfo: requestedUrlInfo,
        outDirectoryUrl: `${projectDirectoryUrl}.jsenv/${scenario}/${runtimeName}@${runtimeVersion}/`,
        runtimeSupport,
      })
      const { response, contentType, content } = requestedUrlInfo
      if (response) {
        return response
      }
      return {
        url: reference.url,
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(content),
          "cache-control": `private,max-age=0,must-revalidate`,
        },
        body: content,
      }
    } catch (e) {
      const code = e.originalError ? e.originalError.code : e.code
      if (code === "PARSE_ERROR") {
        // let the browser re-throw the syntax error
        return {
          url: reference.url,
          status: 200,
          statusText: e.reason,
          statusMessage: e.message,
          headers: {
            "content-type": requestedUrlInfo.contentType,
            "content-length": Buffer.byteLength(requestedUrlInfo.content),
            "cache-control": "no-store",
          },
          body: requestedUrlInfo.content,
        }
      }
      if (code === "EISDIR") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html",
          },
          canReadDirectory: true,
          rootDirectoryUrl: projectDirectoryUrl,
        })
      }
      if (code === "NOT_ALLOWED") {
        return {
          url: reference.url,
          status: 403,
          statusText: e.reason,
        }
      }
      if (code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: e.reason,
          statusMessage: e.message,
        }
      }
      return {
        url: reference.url,
        status: 500,
        statusText: e.reason,
        statusMessage: e.message,
      }
    }
  }
  return async (request) => {
    let response = await getResponse(request)
    if (response.url) {
      pluginController.callHooks(
        "augmentResponse",
        response,
        {},
        (returnValue) => {
          response = composeTwoResponses(response, returnValue)
        },
      )
    }
    return response
  }
}

const inferParentFromRequest = (request, projectDirectoryUrl) => {
  const { referer } = request.headers
  if (!referer) {
    return projectDirectoryUrl
  }
  return moveUrl(referer, request.origin, projectDirectoryUrl)
}
