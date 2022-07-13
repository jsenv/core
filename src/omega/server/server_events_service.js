import { createCallbackList } from "@jsenv/abort"

import { createSSEService } from "@jsenv/core/src/helpers/event_source/sse_service.js"

export const createServerEventsService = ({
  rootDirectoryUrl,
  urlGraph,
  kitchen,
  scenario,
  serverStopCallbackList,
}) => {
  const serverEventCallbackList = createCallbackList()
  const sseService = createSSEService({ serverEventCallbackList })
  serverStopCallbackList.add(() => {
    sseService.destroy()
  })

  kitchen.pluginController.addHook("registerServerEvents")
  const sendServerEvent = (serverEvent) => {
    serverEventCallbackList.notify(serverEvent)
  }
  kitchen.pluginController.callHooks(
    "registerServerEvents",
    { sendServerEvent },
    {
      rootDirectoryUrl,
      urlGraph,
      scenario,
    },
    () => {},
  )
  return (request) => {
    const { accept } = request.headers
    if (accept && accept.includes("text/event-stream")) {
      const room = sseService.getOrCreateSSERoom(request)
      return room.join(request)
    }
    return null
  }
}
