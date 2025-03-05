import { createFileSystemFetch, startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemFetch(import.meta.resolve("./")),
    },
  ],
});
