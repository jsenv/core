export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    handleWebsocket: (websocket) => {
      if (websocket.protocol === "jsenv_server") {
        websocket.send("Hello world");
        return true;
      }
      return false;
    },
  };
};
