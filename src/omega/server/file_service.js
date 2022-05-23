import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { urlIsInsideOf, moveUrl } from "@jsenv/filesystem"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  rootDirectoryUrl,
  urlGraph,
  kitchen,
  scenario,
}) => {
  kitchen.pluginController.addHook("serve")
  kitchen.pluginController.addHook("augmentResponse")
  const serveContext = {
    rootDirectoryUrl,
    urlGraph,
    scenario,
  }

  const getResponse = async (request) => {
    // serve file inside ".jsenv" directory
    const requestFileUrl = new URL(request.ressource.slice(1), rootDirectoryUrl)
      .href
    if (urlIsInsideOf(requestFileUrl, kitchen.jsenvDirectoryUrl)) {
      return fetchFileSystem(requestFileUrl, {
        headers: request.headers,
      })
    }
    const responseFromPlugin =
      await kitchen.pluginController.callAsyncHooksUntil(
        "serve",
        request,
        serveContext,
      )
    if (responseFromPlugin) {
      return responseFromPlugin
    }
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    const [reference, urlInfo] = kitchen.prepareEntryPoint({
      parentUrl: inferParentFromRequest(request, rootDirectoryUrl),
      type: "entry_point",
      specifier: request.ressource,
    })
    const ifNoneMatch = request.headers["if-none-match"]
    if (ifNoneMatch && urlInfo.contentEtag === ifNoneMatch) {
      return {
        status: 304,
        headers: {
          "cache-control": `private,max-age=0,must-revalidate`,
        },
      }
    }
    const referenceFromGraph = urlGraph.inferReference(
      reference.url,
      reference.parentUrl,
    )
    try {
      // urlInfo objects are reused, they must be "reset" before cooking then again
      urlGraph.resetUrlInfo(urlInfo)
      await kitchen.cook({
        reference: referenceFromGraph || reference,
        urlInfo,
        outDirectoryUrl: `${rootDirectoryUrl}.jsenv/${scenario}/${runtimeName}@${runtimeVersion}/`,
        clientRuntimeCompat: {
          [runtimeName]: runtimeVersion,
        },
      })
      let { response, contentType, content, contentEtag } = urlInfo
      if (response) {
        return response
      }
      response = {
        url: reference.url,
        status: 200,
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(content),
          "cache-control": `private,max-age=0,must-revalidate`,
          "eTag": contentEtag,
        },
        body: content,
        timing: urlInfo.timing,
      }
      kitchen.pluginController.callHooks(
        "augmentResponse",
        { reference, urlInfo },
        {},
        (returnValue) => {
          response = composeTwoResponses(response, returnValue)
        },
      )
      return response
    } catch (e) {
      const code = e.code
      if (code === "PARSE_ERROR") {
        // let the browser re-throw the syntax error
        return {
          url: reference.url,
          status: 200,
          statusText: e.reason,
          statusMessage: e.message,
          headers: {
            "content-type": urlInfo.contentType,
            "content-length": Buffer.byteLength(urlInfo.content),
            "cache-control": "no-store",
          },
          body: urlInfo.content,
        }
      }
      if (code === "EISDIR") {
        return serveDirectory(reference.url, {
          headers: {
            accept: "text/html",
          },
          canReadDirectory: true,
          rootDirectoryUrl,
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
        statusMessage: e.stack,
      }
    }
  }
  return async (request) => {
    let response = await getResponse(request)

    return response
  }
}

const inferParentFromRequest = (request, rootDirectoryUrl) => {
  const { referer } = request.headers
  if (!referer) {
    return rootDirectoryUrl
  }
  return moveUrl({
    url: referer,
    from: `${request.origin}/`,
    to: rootDirectoryUrl,
    preferAbsolute: true,
  })
}
