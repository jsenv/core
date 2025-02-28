export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET *",
        headers: {
          "sec-websocket-protocol": "jsenv_server", // au lieu de ça on va faire un endpoint spécial
        },
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
