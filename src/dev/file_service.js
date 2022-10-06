import { readFileSync } from "node:fs"
import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { registerDirectoryLifecycle, bufferToEtag } from "@jsenv/filesystem"
import { urlIsInsideOf, moveUrl, asUrlWithoutSearch } from "@jsenv/urls"
import { URL_META } from "@jsenv/url-meta"

import { createUrlGraph } from "@jsenv/core/src/kitchen/url_graph.js"
import { createKitchen } from "@jsenv/core/src/kitchen/kitchen.js"
import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
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
  urlResolution,
  fileSystemMagicRedirection,
  supervisor,
  transpilation,
  clientAutoreload,
  clientFiles,
  clientMainFileUrl,
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
      onFileChange({
        url: new URL(relativeUrl, rootDirectoryUrl).href,
        event: "added",
      })
    },
    updated: ({ relativeUrl }) => {
      onFileChange({
        url: new URL(relativeUrl, rootDirectoryUrl).href,
        event: "modified",
      })
    },
    removed: ({ relativeUrl }) => {
      onFileChange({
        url: new URL(relativeUrl, rootDirectoryUrl).href,
        event: "removed",
      })
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
    const urlGraph = createUrlGraph()
    clientFileChangeCallbackList.push(({ url }) => {
      const onUrlInfo = (urlInfo) => {
        urlGraph.considerModified(urlInfo)
      }
      const exactUrlInfo = urlGraph.getUrlInfo(url)
      if (exactUrlInfo) {
        onUrlInfo(exactUrlInfo)
      }
      urlGraph.urlInfoMap.forEach((urlInfo) => {
        if (urlInfo === exactUrlInfo) return
        const urlWithoutSearch = asUrlWithoutSearch(urlInfo.url)
        if (urlWithoutSearch !== url) return
        if (exactUrlInfo && exactUrlInfo.dependents.has(urlInfo.url)) return
        onUrlInfo(urlInfo)
      })
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
          urlResolution,
          fileSystemMagicRedirection,
          supervisor,
          transpilation,

          clientMainFileUrl,
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
      outDirectoryUrl: scenarios.dev
        ? `${rootDirectoryUrl}.jsenv/${runtimeName}@${runtimeVersion}/`
        : `${rootDirectoryUrl}.jsenv/build/${runtimeName}@${runtimeVersion}/`,
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
          let fileContentAsBuffer
          try {
            fileContentAsBuffer = readFileSync(new URL(urlInfo.url))
          } catch (e) {
            if (e.code === "ENOENT") {
              return false
            }
            return false
          }
          const fileContentEtag = bufferToEtag(fileContentAsBuffer)
          if (fileContentEtag !== urlInfo.originalContentEtag) {
            return false
          }
        }
        for (const implicitUrl of urlInfo.implicitUrls) {
          const implicitUrlInfo = context.urlGraph.getUrlInfo(implicitUrl)
          if (implicitUrlInfo && !implicitUrlInfo.isValid()) {
            return false
          }
        }
        return true
      }
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
    const { urlGraph, kitchen } = getOrCreateContext(request)
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
    const urlInfoTargetedByCache = urlGraph.getParentIfInline(urlInfo)

    try {
      if (ifNoneMatch) {
        const [clientOriginalContentEtag, clientContentEtag] =
          ifNoneMatch.split("_")
        if (
          urlInfoTargetedByCache.originalContentEtag ===
            clientOriginalContentEtag &&
          urlInfoTargetedByCache.contentEtag === clientContentEtag &&
          urlInfoTargetedByCache.isValid()
        ) {
          const headers = {
            "cache-control": `private,max-age=0,must-revalidate`,
          }
          Object.keys(urlInfo.headers).forEach((key) => {
            if (key !== "content-length") {
              headers[key] = urlInfo.headers[key]
            }
          })
          return {
            status: 304,
            headers,
          }
        }
      }

      // urlInfo objects are reused, they must be "reset" before cooking them again
      if (
        (urlInfo.error || urlInfo.contentEtag) &&
        !urlInfo.isInline &&
        urlInfo.type !== "sourcemap"
      ) {
        urlInfo.error = null
        urlInfo.sourcemap = null
        urlInfo.sourcemapIsWrong = null
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
      })
      let { response } = urlInfo
      if (response) {
        return response
      }
      response = {
        url: reference.url,
        status: 200,
        headers: {
          "cache-control": `private,max-age=0,must-revalidate`,
          // it's safe to use "_" separator because etag is encoded with base64 (see https://stackoverflow.com/a/13195197)
          "eTag": `${urlInfoTargetedByCache.originalContentEtag}_${urlInfoTargetedByCache.contentEtag}`,
          ...urlInfo.headers,
          "content-type": urlInfo.contentType,
          "content-length": Buffer.byteLength(urlInfo.content),
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
      const originalError = e ? e.cause || e : e
      if (originalError.asResponse) {
        return originalError.asResponse()
      }
      const code = originalError.code
      if (code === "PARSE_ERROR") {
        // when possible let browser re-throw the syntax error
        // it's not possible to do that when url info content is not available
        // (happens for as_js_classic library for instance)
        if (urlInfo.content !== undefined) {
          return {
            url: reference.url,
            status: 200,
            // reason becomes the http response statusText, it must not contain invalid chars
            // https://github.com/nodejs/node/blob/0c27ca4bc9782d658afeaebcec85ec7b28f1cc35/lib/_http_common.js#L221
            statusText: e.reason,
            statusMessage: originalError.message,
            headers: {
              "content-type": urlInfo.contentType,
              "content-length": Buffer.byteLength(urlInfo.content),
              "cache-control": "no-store",
            },
            body: urlInfo.content,
          }
        }
        return {
          url: reference.url,
          status: 500,
          statusText: e.reason,
          statusMessage: originalError.message,
          headers: {
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
          statusText: originalError.reason,
        }
      }
      if (code === "NOT_FOUND") {
        return {
          url: reference.url,
          status: 404,
          statusText: originalError.reason,
          statusMessage: originalError.message,
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
