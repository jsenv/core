import { createObservableBody } from "../../interfacing_with_node/observable_body.js";

export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/alive.websocket",
        description:
          "Websocket client can connect to this endpoint to detect when server connection is lost (when server restarts).",
        /* eslint-disable no-undef */
        clientCodeExample: () => {
          const websocket = new WebSocket(
            "ws://localhost/.internal/alive.websocket",
          );
          websocket.onerror = () => {
            // server connection closed
            window.location.reload();
          };
        },
        /* eslint-enable no-undef */
        websocket: () => {
          return {
            open: (websocket) => {
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
        endpoint: "GET /.internal/alive.longpolling",
        description:
          "Long polling client can connect to this endpoint to detect when server connection is lost (when server restarts).",
        /* eslint-disable no-undef */
        clientCodeExample: async () => {
          await fetch("/.internal/alive.longpolling");
          // server connection closed
          window.location.reload();
        },
        request: () => {
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
