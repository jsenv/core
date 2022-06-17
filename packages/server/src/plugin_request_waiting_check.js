import { createDetailedMessage } from "@jsenv/log"

export const pluginRequestWaitingCheck = ({
  requestWaitingMs = 20000,
  requestWaitingCallback = ({ request, logger, requestWaitingMs }) => {
    logger.warn(
      createDetailedMessage(
        `still no response found for request after ${requestWaitingMs} ms`,
        {
          "request url": `${request.origin}${request.ressource}`,
          "request headers": JSON.stringify(request.headers, null, "  "),
        },
      ),
    )
  },
} = {}) => {
  return {
    plugin_request_waiting_check: {
      onRequest: (request, { logger }) => {
        const timeout = setTimeout(
          () => requestWaitingCallback({ request, logger, requestWaitingMs }),
          requestWaitingMs,
        )
        return {
          onResponse: () => {
            clearTimeout(timeout)
          },
        }
      },
    },
  }
}
