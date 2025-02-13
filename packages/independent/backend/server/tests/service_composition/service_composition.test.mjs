import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";

const noContentService = (request) => {
  if (request.pathname !== "/") return null;
  return { status: 204 };
};

const okService = (request) => {
  if (request.pathname !== "/whatever") return null;
  return { status: 200 };
};

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  services: [
    {
      name: "nocontent",
      handleRequest: noContentService,
    },
    {
      name: "ok",
      handleRequest: okService,
    },
  ],
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
    status: 204,
    statusText: "No Content",
    headers: {
      "connection": "keep-alive",
      "date": actual.headers.date,
      "keep-alive": "timeout=5",
    },
    body: "",
  };
  assert({ actual, expect });
}

{
  const response = await fetchUrl(`${origin}/whatever`);
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url: `${origin}/whatever`,
    status: 200,
    statusText: "OK",
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
