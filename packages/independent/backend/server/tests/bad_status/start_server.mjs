import { createFileSystemFetch, startServer } from "@jsenv/server";

export const server = await startServer({
  logLevel: "error",
  routes: [
    {
      endpoint: "GET /public/*",
      fetch: createFileSystemFetch(import.meta.resolve("./client/")),
    },
    {
      endpoint: "GET /api/data.json",
      fetch: () => {
        return Response.json({ answer: 42 });
      },
    },
  ],
});
