import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";

const { origin, stop } = await startServer({
  logLevel: "off",
  keepProcessAlive: false,
});

{
  const response = await fetchUrl(origin);
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url: `${origin}/`,
    status: 501,
    statusText: "Not Implemented",
    headers: {
      "connection": "keep-alive",
      "date": actual.headers.date,
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked",
    },
    body: "",
  };
  assert({ actual, expect });
}

stop();
