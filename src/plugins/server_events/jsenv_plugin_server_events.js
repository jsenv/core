/*
 * This plugin is very special because it is here
 * to provide "serverEvents" used by other plugins
 */

import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast"

import { createServerEventsDispatcher } from "./server_events_dispatcher.js"

const serverEventsClientFileUrl = new URL(
  "./client/server_events_client.js",
  import.meta.url,
).href

export const jsenvPluginServerEvents = ({
  rootDirectoryUrl,
  urlGraph,
  scenario,
  kitchen,
  onErrorWhileServingFileReference,
}) => {
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
  if (serverEventNames.length === 0) {
    return
  }

  serverEventNames.forEach((serverEventName) => {
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
  const serverEventsDispatcher = createServerEventsDispatcher()
  onErrorWhileServingFileReference.current = (data) => {
    serverEventsDispatcher.dispatchToRoomsMatching(
      {
        type: "error_while_serving_file",
        data,
      },
      (room) => {
        // send only to page depending on this file
        const errorFileUrl = data.url
        const roomEntryPointUrl = new URL(
          room.request.ressource.slice(1),
          rootDirectoryUrl,
        ).href
        const isErrorRelatedToEntryPoint = Boolean(
          urlGraph.findDependent(errorFileUrl, (dependentUrlInfo) => {
            return dependentUrlInfo.url === roomEntryPointUrl
          }),
        )
        return isErrorRelatedToEntryPoint
      },
    )
  }
  const jsenvServerEventPlugin = {
    name: "jsenv:server_events",
    appliesDuring: "*",
    destroy: () => {
      serverEventsDispatcher.destroy()
    },
    serve: (request) => {
      const { accept } = request.headers
      if (accept && accept.includes("text/event-stream")) {
        const room = serverEventsDispatcher.addRoom(request)
        return room.join(request)
      }
      return null
    },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const [serverEventsClientFileReference] = context.referenceUtils.inject(
          {
            type: "script_src",
            expectedType: "js_module",
            specifier: serverEventsClientFileUrl,
          },
        )
        injectScriptNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": serverEventsClientFileReference.generatedSpecifier,
            "injected-by": "jsenv:server_events",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
    },
  }
  kitchen.pluginController.pushPlugin(jsenvServerEventPlugin)
}
