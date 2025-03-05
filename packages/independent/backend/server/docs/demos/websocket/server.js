import { createFileSystemFetch, startServer } from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemFetch(import.meta.resolve("./")),
      websocket: () => {
        return {
          opened: (websocket) => {
            websocket.send("Hello world");
          },
        };
      },
    },
  ],
});
