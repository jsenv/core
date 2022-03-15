import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { urlIsInsideOf } from "@jsenv/filesystem"

import { moveUrl } from "@jsenv/core/src/utils/url_utils.js"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  projectDirectoryUrl,
  urlGraph,
  pluginController,
  kitchen,
  scenario,
}) => {
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
    const responseFromPlugin = pluginController.callHooksUntil("serve", request)
    if (responseFromPlugin) {
      return responseFromPlugin
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
    await kitchen.cook({
      reference: referenceFromGraph || reference,
      urlInfo: requestedUrlInfo,
      outDirectoryName: `${scenario}/${runtimeName}@${runtimeVersion}`,
      runtimeSupport,
    })
    const { response, error, contentType, content } = requestedUrlInfo
    if (response) {
      return response
    }
    if (error) {
      if (
        error.name === "TRANSFORM_ERROR" &&
        error.originalError.code === "PARSE_ERROR"
      ) {
        // let the browser re-throw the syntax error
        return {
          url: reference.url,
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
      if (error.originalError && error.originalError.code === "EISDIR") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html",
          },
          canReadDirectory: true,
          rootDirectoryUrl: projectDirectoryUrl,
        })
      }
      if (error.code === "NOT_ALLOWED") {
        return {
          url: reference.url,
          status: 403,
          statusText: error.reason,
        }
      }
      if (error.code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: error.reason,
          statusMessage: error.message,
        }
      }
      return {
        url: reference.url,
        status: 500,
        statusText: error.reason,
        statusMessage: error.message,
      }
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
  }
  return async (request) => {
    let response = await getResponse(request)
    if (response.url) {
      pluginController.callPluginHook("augmentResponse", (returnValue) => {
        response = composeTwoResponses(response, returnValue)
      })
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
