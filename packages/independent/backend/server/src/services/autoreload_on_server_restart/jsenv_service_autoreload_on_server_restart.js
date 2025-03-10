import { LazyServerEvents } from "../../server_events.js";

export const jsenvServiceAutoreloadOnRestart = () => {
  const aliveServerEvents = new LazyServerEvents(() => {});

  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/alive.websocket",
        description:
          "Client can connect to this websocket endpoint to detect when server connection is lost.",
        declarationSource: import.meta.url,
        /* eslint-disable no-undef */
        clientCodeExample: () => {
          const websocket = new WebSocket(
            "ws://localhost/.internal/alive.websocket",
          );
          websocket.onclose = () => {
            // server connection closed
            window.location.reload();
          };
        },
        fetch: aliveServerEvents.fetch,
      },
      {
        endpoint: "GET /.internal/alive.eventsource",
        description: `Client can connect to this eventsource endpoint to detect when server connection is lost.
This endpoint exists mostly to demo eventsource as there is already the websocket endpoint.`,
        declarationSource: import.meta.url,
        /* eslint-disable no-undef */
        clientCodeExample: async () => {
          const eventSource = new EventSource("/.internal/alive.eventsource");
          eventSource.onerror = () => {
            // server connection closed
            window.location.reload();
          };
        },
        /* eslint-enable no-undef */
        fetch: aliveServerEvents.fetch,
      },
    ],
  };
};
