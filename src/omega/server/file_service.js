import { readFileSync } from "node:fs"
import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { registerDirectoryLifecycle, bufferToEtag } from "@jsenv/filesystem"
import { urlIsInsideOf, moveUrl } from "@jsenv/urls"
import { URL_META } from "@jsenv/url-meta"

import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { jsenvPluginServerEventsClientInjection } from "@jsenv/core/src/plugins/server_events/jsenv_plugin_server_events_client_injection.js"
import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logLevel,
  serverStopCallbacks,
  serverEventsDispatcher,

  rootDirectoryUrl,
  scenarios,
  runtimeCompat,

  plugins,
  urlAnalysis,
  supervisor,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  clientAutoreload,
  clientFiles,
  cooldownBetweenFileEvents,
  explorer,
  sourcemaps,
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  writeGeneratedFiles,
}) => {
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href

  const clientFileChangeCallbackList = []
  const clientFilesPruneCallbackList = []
  const clientFilePatterns = {
    ...clientFiles,
    ".jsenv/": false,
  }

  const onFileChange = (url) => {
    clientFileChangeCallbackList.forEach((callback) => {
      callback(url)
    })
  }
  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFilePatterns,
    cooldownBetweenFileEvents,
    keepProcessAlive: false,
    recursive: true,
    added: ({ relativeUrl }) => {
      onFileChange(new URL(relativeUrl, rootDirectoryUrl).href)
    },
    updated: ({ relativeUrl }) => {
      onFileChange(new URL(relativeUrl, rootDirectoryUrl).href)
    },
    removed: ({ relativeUrl }) => {
      onFileChange(new URL(relativeUrl, rootDirectoryUrl).href)
    },
  })
  serverStopCallbacks.push(stopWatchingClientFiles)

  const contextCache = new Map()
  const getOrCreateContext = (request) => {
    const { runtimeName, runtimeVersion } = parseUserAgentHeader(
      request.headers["user-agent"],
    )
    const runtimeId = `${runtimeName}@${runtimeVersion}`
    const existingContext = contextCache.get(runtimeId)
    if (existingContext) {
      return existingContext
    }
    const watchAssociations = URL_META.resolveAssociations(
      { watch: clientFilePatterns },
      rootDirectoryUrl,
    )
    const urlGraph = createUrlGraph({
      includeOriginalUrls: scenarios.dev,
    })
    clientFileChangeCallbackList.push((url) => {
      const urlInfo = urlGraph.getUrlInfo(url)
      if (urlInfo) {
        urlGraph.considerModified(urlInfo)
      }
    })
    const kitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl,
      scenarios,
      runtimeCompat,
      clientRuntimeCompat: {
        [runtimeName]: runtimeVersion,
      },
      urlGraph,
      plugins: [
        ...plugins,
        ...getCorePlugins({
          rootDirectoryUrl,
          runtimeCompat,

          urlAnalysis,
          supervisor,
          nodeEsmResolution,
          fileSystemMagicResolution,
          transpilation,

          clientAutoreload,
          clientFileChangeCallbackList,
          clientFilesPruneCallbackList,
          explorer,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesProtocol,
      sourcemapsSourcesContent,
      writeGeneratedFiles,
    })
    urlGraph.createUrlInfoCallbackRef.current = (urlInfo) => {
      const { watch } = URL_META.applyAssociations({
        url: urlInfo.url,
        associations: watchAssociations,
      })
      urlInfo.isWatched = watch
      // si une urlInfo dépends de pleins d'autres alors
      // on voudrait check chacune de ces url infos (package.json dans mon cas)
      urlInfo.isValid = () => {
        if (!urlInfo.url.startsWith("file:")) {
          return false
        }
        if (watch && urlInfo.contentEtag === undefined) {
          // we trust the watching mecanism
          // doing urlInfo.contentEtag = undefined
          // when file is modified
          return false
        }
        if (!watch) {
          const fileContentAsBuffer = readFileSync(new URL(urlInfo.url))
          const fileContentEtag = bufferToEtag(fileContentAsBuffer)
          if (fileContentEtag !== urlInfo.originalContentEtag) {
            return false
          }
        }
        for (const related of urlInfo.relateds) {
          const relatedUrlInfo = context.urlGraph.getUrlInfo(related)
          if (relatedUrlInfo && !relatedUrlInfo.isValid()) {
            return false
          }
        }
        return true
      }
      kitchen.pluginController.callHooks(
        "createUrlInfo",
        urlInfo,
        kitchen.kitchenContext,
      )
    }
    urlGraph.prunedUrlInfosCallbackRef.current = (urlInfos, firstUrlInfo) => {
      clientFilesPruneCallbackList.forEach((callback) => {
        callback(urlInfos, firstUrlInfo)
      })
    }
    serverStopCallbacks.push(() => {
      kitchen.pluginController.callHooks("destroy", kitchen.kitchenContext)
    })
    server_events: {
      const allServerEvents = {}
      kitchen.pluginController.plugins.forEach((plugin) => {
        const { serverEvents } = plugin
        if (serverEvents) {
          Object.keys(serverEvents).forEach((serverEventName) => {
            // we could throw on serverEvent name conflict
            // we could throw if serverEvents[serverEventName] is not a function
            allServerEvents[serverEventName] = serverEvents[serverEventName]
          })
        }
      })
      const serverEventNames = Object.keys(allServerEvents)
      if (serverEventNames.length > 0) {
        Object.keys(allServerEvents).forEach((serverEventName) => {
          allServerEvents[serverEventName]({
            rootDirectoryUrl,
            urlGraph,
            scenarios,
            sendServerEvent: (data) => {
              serverEventsDispatcher.dispatch({
                type: serverEventName,
                data,
              })
            },
          })
        })
        // "pushPlugin" so that event source client connection can be put as early as possible in html
        kitchen.pluginController.pushPlugin(
          jsenvPluginServerEventsClientInjection(),
        )
      }
    }

    const context = {
      rootDirectoryUrl,
      scenarios,
      runtimeName,
      runtimeVersion,
      urlGraph,
      kitchen,
    }
    contextCache.set(runtimeId, context)
    return context
  }

  return async (request) => {
    // serve file inside ".jsenv" directory
    const requestFileUrl = new URL(request.resource.slice(1), rootDirectoryUrl)
      .href
    if (urlIsInsideOf(requestFileUrl, jsenvDirectoryUrl)) {
      return fetchFileSystem(requestFileUrl, {
        headers: request.headers,
      })
    }
    const { runtimeName, runtimeVersion, urlGraph, kitchen } =
      getOrCreateContext(request)
    const responseFromPlugin =
      await kitchen.pluginController.callAsyncHooksUntil(
        "serve",
        request,
        kitchen.kitchenContext,
      )
    if (responseFromPlugin) {
      return responseFromPlugin
    }
    let reference
    const parentUrl = inferParentFromRequest(request, rootDirectoryUrl)
    if (parentUrl) {
      reference = urlGraph.inferReference(request.resource, parentUrl)
    }
    if (!reference) {
      const entryPoint = kitchen.injectReference({
        trace: { message: parentUrl || rootDirectoryUrl },
        parentUrl: parentUrl || rootDirectoryUrl,
        type: "http_request",
        specifier: request.resource,
      })
      reference = entryPoint[0]
    }
    const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)
    const ifNoneMatch = request.headers["if-none-match"]
    const urlInfoTargetedByCache = urlInfo.isInline
      ? urlGraph.getUrlInfo(urlInfo.inlineUrlSite.url)
      : urlInfo

    if (ifNoneMatch) {
      if (
        urlInfoTargetedByCache.contentEtag === ifNoneMatch &&
        urlInfoTargetedByCache.isValid()
      ) {
        return {
          status: 304,
          headers: {
            "cache-control": `private,max-age=0,must-revalidate`,
            ...urlInfo.headers,
          },
        }
      }
    }
    try {
      // urlInfo objects are reused, they must be "reset" before cooking them again
      if (
        urlInfo.contentEtag &&
        !urlInfo.isInline &&
        urlInfo.type !== "sourcemap"
      ) {
        urlInfo.error = null
        urlInfo.sourcemap = null
        urlInfo.sourcemapReference = null
        urlInfo.content = null
        urlInfo.originalContent = null
        urlInfo.type = null
        urlInfo.subtype = null
        urlInfo.timing = {}
      }
      await kitchen.cook(urlInfo, {
        request,
        reference,
        outDirectoryUrl: scenarios.dev
          ? `${rootDirectoryUrl}.jsenv/${runtimeName}@${runtimeVersion}/`
          : `${rootDirectoryUrl}.jsenv/${
              scenarios.test ? "test" : "build"
            }/${runtimeName}@${runtimeVersion}/`,
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
          "eTag": urlInfoTargetedByCache.contentEtag,
          ...urlInfo.headers,
          "content-type": urlInfo.contentType,
        },
        body: urlInfo.content,
        timing: urlInfo.timing,
      }
      kitchen.pluginController.callHooks(
        "augmentResponse",
        { reference, urlInfo },
        kitchen.kitchenContext,
        (returnValue) => {
          response = composeTwoResponses(response, returnValue)
        },
      )
      return response
    } catch (e) {
      urlInfo.error = e
      const code = e.code
      if (code === "PARSE_ERROR") {
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
