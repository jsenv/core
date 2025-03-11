import { createFileSystemFetch, startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./")),
    },
  ],
});
