import {
  createFileSystemFetch,
  startServer,
  WebSocketResponse,
} from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET *",
      headers: {
        upgrade: "websocket",
      },
      websocket: () => {
        return new WebSocketResponse((websocket) => {
          websocket.send("Hello world");
        });
      },
    },
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./")),
    },
  ],
});
