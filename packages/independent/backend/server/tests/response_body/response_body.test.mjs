import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";
import { promises } from "node:fs";

import { fromFetchResponse, startServer } from "@jsenv/server";

// file handle
{
  const server = await startServer({
    keepProcessAlive: false,
    logLevel: "warn",
    services: [
      {
        handleRequest: async () => {
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
      services: [
        {
          handleRequest: async () => {
            const response = await fetchUrl(server.origin);
            return fromFetchResponse(response);
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
