import { createFileSystemRequestHandler, startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemRequestHandler(import.meta.resolve("./")),
    },
  ],
});
