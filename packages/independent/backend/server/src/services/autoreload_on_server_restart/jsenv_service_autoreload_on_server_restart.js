import { SSE } from "../../sse.js";

const aliveServerSentEvents = new SSE();

export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/alive.websocket",
        description:
          "Client can connect to this websocket endpoint to detect when server connection is lost.",
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
        fetch: aliveServerSentEvents.fetch,
      },
      {
        endpoint: "GET /.internal/alive.eventsource",
        description: `Client can connect to this eventsource endpoint to detect when server connection is lost.
This endpoint exists mostly to demo eventsource as there is already the websocket endpoint.`,
        /* eslint-disable no-undef */
        clientCodeExample: async () => {
          const eventSource = new EventSource("/.internal/alive.eventsource");
          eventSource.onerror = () => {
            // server connection closed
            window.location.reload();
          };
        },
        /* eslint-enable no-undef */
        fetch: aliveServerSentEvents.fetch,
      },
      {
        endpoint: "GET /.internal/alive.longpolling",
        description: `Client can connect to this endpoint to detect when server connection is lost.
This endpoint exists mostly to demo longpolling as there is already the websocket endpoint.`,
        /* eslint-disable no-undef */
        clientCodeExample: async () => {
          await fetch("/.internal/alive.longpolling");
          // server connection closed
          window.location.reload();
        },
        /* eslint-enable no-undef */
        fetch: aliveServerSentEvents.fetch,
      },
    ],
  };
};
