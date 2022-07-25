import {
  fetchFileSystem,
  serveDirectory,
  composeTwoResponses,
} from "@jsenv/server"
import { registerDirectoryLifecycle } from "@jsenv/filesystem"
import { urlIsInsideOf, moveUrl } from "@jsenv/urls"
import { URL_META } from "@jsenv/url-meta"

import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { createServerEventsDispatcher } from "@jsenv/core/src/plugins/server_events/server_events_dispatcher.js"
import { jsenvPluginServerEventsClientInjection } from "@jsenv/core/src/plugins/server_events/jsenv_plugin_server_events_client_injection.js"
import { parseUserAgentHeader } from "./user_agent.js"

export const createFileService = ({
  signal,
  logLevel,
  serverStopCallbacks,

  rootDirectoryUrl,
  scenario,
  runtimeCompat,

  plugins,
  urlAnalysis,
  htmlSupervisor,
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
  const clientFileChangeCallback = ({ relativeUrl, event }) => {
    const url = new URL(relativeUrl, rootDirectoryUrl).href
    clientFileChangeCallbackList.forEach((callback) => {
      callback({ url, event })
    })
  }
  const clientFilePatterns = {
    ...clientFiles,
    ".jsenv/": false,
  }

  if (scenario === "dev") {
    const stopWatchingClientFiles = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns: clientFilePatterns,
        cooldownBetweenFileEvents,
        keepProcessAlive: false,
        recursive: true,
        added: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "added", relativeUrl })
        },
        updated: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "modified", relativeUrl })
        },
        removed: ({ relativeUrl }) => {
          clientFileChangeCallback({ event: "removed", relativeUrl })
        },
      },
    )
    serverStopCallbacks.push(stopWatchingClientFiles)
  }

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
      clientFileChangeCallbackList,
      clientFilesPruneCallbackList,
      onCreateUrlInfo: (urlInfo) => {
        const { watch } = URL_META.applyAssociations({
          url: urlInfo.url,
          associations: watchAssociations,
        })
        urlInfo.isValid = () => watch
      },
      includeOriginalUrls: scenario === "dev",
    })
    const kitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl,
      scenario,
      runtimeCompat,
      clientRuntimeCompat: {
        [runtimeName]: runtimeVersion,
      },
      urlGraph,
      plugins: [
        ...plugins,
        ...getCorePlugins({
          rootDirectoryUrl,
          scenario,
          runtimeCompat,

          urlAnalysis,
          htmlSupervisor,
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
        const serverEventsDispatcher = createServerEventsDispatcher()
        serverStopCallbacks.push(() => {
          serverEventsDispatcher.destroy()
        })
        Object.keys(allServerEvents).forEach((serverEventName) => {
          allServerEvents[serverEventName]({
            rootDirectoryUrl,
            urlGraph,
            scenario,
            sendServerEvent: (data) => {
              serverEventsDispatcher.dispatch({
                type: serverEventName,
                data,
              })
            },
          })
        })
        // "unshift" because serve must come first to catch event source client request
        kitchen.pluginController.unshiftPlugin({
          name: "jsenv:provide_server_events",
          serve: (request) => {
            const { accept } = request.headers
            if (accept && accept.includes("text/event-stream")) {
              const room = serverEventsDispatcher.addRoom(request)
              return room.join(request)
            }
            return null
          },
        })
        // "push" so that event source client connection can be put as early as possible in html
        kitchen.pluginController.pushPlugin(
          jsenvPluginServerEventsClientInjection(),
        )
      }
    }

    const context = {
      rootDirectoryUrl,
      scenario,
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
    const requestFileUrl = new URL(request.ressource.slice(1), rootDirectoryUrl)
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
      // urlInfo.isValid
      // - is false by default because there must be some logic capable
      //   to invalidate the url (otherwise server would return 304 forever)
      // - is set to a function returning true if the file is watched
      //   in start_dev_server.js
      // - is set to a custom function by cjs_to_esm in compiled_file_cache.js
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
        urlInfo.error = null
        urlInfo.sourcemap = null
        urlInfo.sourcemapReference = null
        urlInfo.content = null
        urlInfo.originalContent = null
        urlInfo.type = null
        urlInfo.subtype = null
        urlInfo.dependsOnPackageJson = false
        urlInfo.timing = {}
      }
      await kitchen.cook(urlInfo, {
        request,
        reference,
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
