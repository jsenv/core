import { createFileSystemFetch, startServer } from "@jsenv/server";

export const server = await startServer({
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./client/")),
    },
  ],
});
