export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /.internal/websocket",
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
