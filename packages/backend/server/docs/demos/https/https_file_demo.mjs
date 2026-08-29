import { startServer } from "@jsenv/server";
import { readFileSync } from "node:fs";

await startServer({
  https: {
    certificate: readFileSync(new URL("./server.crt", import.meta.url), "utf8"),
    privateKey: readFileSync(new URL("./server.key", import.meta.url), "utf8"),
  },
  allowHttpRequestOnHttps: true,
  routes: [
    {
      endpoint: "GET *",
      fetch: (request) => {
        const clientUsesHttp = request.origin.startsWith("http:");
        return new Response(
          clientUsesHttp ? `Welcome http user` : `Welcome https user`,
        );
      },
    },
  ],
});
