import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";
import { startServer } from "@jsenv/server";
import { promises } from "node:fs";

// file handle
{
  const server = await startServer({
    keepProcessAlive: false,
    logLevel: "warn",
    routes: [
      {
        endpoint: "GET *",
        fetch: async () => {
          const response = {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: await promises.open(
              new URL("./file.txt", import.meta.url),
              "r",
            ),
          };
          return response;
        },
      },
    ],
  });
  const response = await fetchUrl(server.origin);
  const actual = await response.text();
  const expect = "Hello";
  assert({ actual, expect });

  // node-fetch response
  {
    const serverB = await startServer({
      keepProcessAlive: false,
      logLevel: "warn",
      routes: [
        {
          endpoint: "GET *",
          fetch: async () => {
            const response = await fetchUrl(server.origin);
            return response;
          },
        },
      ],
    });
    const response = await fetchUrl(serverB.origin);
    const actual = await response.text();
    const expect = "Hello";
    assert({ actual, expect });
  }
}
