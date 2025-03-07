import { createFileSystemFetch, startServer } from "@jsenv/server";

export const server = await startServer({
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
