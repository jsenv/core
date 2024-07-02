import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";

{
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    port: 8998,
    services: [
      {
        handleRequest: () => {
          return {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
            },
            body: "ok",
          };
        },
      },
    ],
  });

  const response = await fetchUrl(server.origin);
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url: `${server.origin}/`,
    status: 200,
    statusText: "OK",
    headers: {
      "connection": "keep-alive",
      "content-type": "text/plain",
      "date": actual.headers.date,
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked",
    },
    body: "ok",
  };
  assert({ actual, expect });
}

// can be calld without arg, returns 501
{
  const server = await startServer({
    logLevel: "off",
  });
  try {
    const response = await fetchUrl(server.origin);
    const actual = {
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      size: response.size,
    };
    const expect = {
      status: 501,
      statusText: "Not Implemented",
      headers: {
        "connection": "keep-alive",
        "date": actual.headers.date,
        "keep-alive": "timeout=5",
        "transfer-encoding": "chunked",
      },
      size: 0,
    };
    assert({ actual, expect });
  } finally {
    await server.stop();
  }
}
