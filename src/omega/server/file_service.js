import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { urlIsInsideOf, moveUrl } from "@jsenv/urls"

import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  rootDirectoryUrl,
  urlGraph,
  kitchen,
  scenario,
  onParseError,
  onFileNotFound,
}) => {
  kitchen.pluginController.addHook("serve")
  kitchen.pluginController.addHook("augmentResponse")
  const serveContext = {
    rootDirectoryUrl,
    urlGraph,
    scenario,
  }
  const augmentResponseContext = {
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
    let reference
    const parentUrl = inferParentFromRequest(request, rootDirectoryUrl)
    if (parentUrl) {
      reference = urlGraph.inferReference(request.ressource, parentUrl)
    }
    if (!reference) {
      const entryPoint = kitchen.injectReference({
        trace: { message: parentUrl || rootDirectoryUrl },
        parentUrl: parentUrl || rootDirectoryUrl,
        type: "http_request",
        specifier: request.ressource,
      })
      reference = entryPoint[0]
    }
    const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)

    const ifNoneMatch = request.headers["if-none-match"]
    if (
      ifNoneMatch &&
      urlInfo.contentEtag === ifNoneMatch &&
      // - isValid is true by default
      // - isValid can be overriden by plugins such as cjs_to_esm
      urlInfo.isValid()
    ) {
      return {
        status: 304,
        headers: {
          "cache-control": `private,max-age=0,must-revalidate`,
          ...urlInfo.headers,
        },
      }
    }
    try {
      // urlInfo objects are reused, they must be "reset" before cooking them again
      if (
        urlInfo.contentEtag &&
        !urlInfo.isInline &&
        urlInfo.type !== "sourcemap"
      ) {
        urlInfo.sourcemap = null
        urlInfo.sourcemapReference = null
        urlInfo.content = null
        urlInfo.originalContent = null
        urlInfo.type = null
        urlInfo.subtype = null
        urlInfo.dependsOnPackageJson = false
        urlInfo.timing = {}
      }
      const { runtimeName, runtimeVersion } = parseUserAgentHeader(
        request.headers["user-agent"],
      )
      await kitchen.cook(urlInfo, {
        request,
        reference,
        clientRuntimeCompat: {
          [runtimeName]: runtimeVersion,
        },
        outDirectoryUrl:
          scenario === "dev"
            ? `${rootDirectoryUrl}.jsenv/${runtimeName}@${runtimeVersion}/`
            : `${rootDirectoryUrl}.jsenv/${scenario}/${runtimeName}@${runtimeVersion}/`,
      })
      let { response } = urlInfo
      if (response) {
        return response
      }
      response = {
        url: reference.url,
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(urlInfo.content),
          "cache-control": `private,max-age=0,must-revalidate`,
          "eTag": urlInfo.contentEtag,
          ...urlInfo.headers,
          "content-type": urlInfo.contentType,
        },
        body: urlInfo.content,
        timing: urlInfo.timing,
      }
      kitchen.pluginController.callHooks(
        "augmentResponse",
        { reference, urlInfo },
        augmentResponseContext,
        (returnValue) => {
          response = composeTwoResponses(response, returnValue)
        },
      )
      return response
    } catch (e) {
      const code = e.code
      if (code === "PARSE_ERROR") {
        onParseError({
          reason: e.reason,
          message: e.message,
          url: e.url,
          line: e.line,
          column: e.column,
          contentFrame: e.contentFrame,
        })
        return {
          url: reference.url,
          status: 200, // let the browser re-throw the syntax error
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
      if (code === "DIRECTORY_REFERENCE_NOT_ALLOWED") {
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
        onFileNotFound({
          reason: e.reason,
          message: e.message,
          url: e.url,
          line: e.line,
          column: e.column,
          contentFrame: e.contentFrame,
        })
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
    return null
  }
  const refererUrlObject = new URL(referer)
  refererUrlObject.searchParams.delete("hmr")
  refererUrlObject.searchParams.delete("v")
  const { pathname, search } = refererUrlObject
  if (pathname.startsWith("/@fs/")) {
    const fsRootRelativeUrl = pathname.slice("/@fs/".length)
    return `file:///${fsRootRelativeUrl}${search}`
  }
  return moveUrl({
    url: referer,
    from: `${request.origin}/`,
    to: rootDirectoryUrl,
    preferAbsolute: true,
  })
}
