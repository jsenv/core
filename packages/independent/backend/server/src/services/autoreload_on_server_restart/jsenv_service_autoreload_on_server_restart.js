import { createObservableBody } from "../../interfacing_with_node/observable_body.js";
import { createSSERoom } from "../../sse/sse_room.js";

const aliveRoom = createSSERoom();

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
        /* eslint-enable no-undef */
        websocket: () => {
          return {
            opened: (websocket) => {
              websocket.send("Hello world!");
              websocket.onmessage = () => {
                console.log("websocket message");
              };
              return () => {
                console.log("websocket closed");
              };
            },
          };
        },
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
        response: (request) => {
          return aliveRoom.join(request);
        },
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
        response: () => {
          return {
            status: 200,
            headers: {
              "content-type": "text/plain",
            },
            body: createObservableBody({
              opened: () => "",
            }),
          };
        },
      },
    ],
  };
};
