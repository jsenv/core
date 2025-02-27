export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET *",
        headers: {
          "upgrade": "websocket",
          "sec-websocket-protocol": "jsenv_server",
        },
        websocket: true,
        response: () => {
          return new Response("hello world");
        },
      },
    ],
  };
};
