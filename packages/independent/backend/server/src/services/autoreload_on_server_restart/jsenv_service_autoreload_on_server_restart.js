export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/alive.websocket",
        description:
          "Websocket client can connect to this endpoint to detect when server connection is lost (when server restarts).",
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
    ],
  };
};
