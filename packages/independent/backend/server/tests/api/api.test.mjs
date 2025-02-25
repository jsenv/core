import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";
import { startServer } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";

const apiServer = await startServer({
  logLevel: "warn",
  routes: [
    {
      endpoint: "GET /",
      response: () => new Response("Hello world"),
    },
  ],
});
const response = await fetchUrl(`${apiServer.origin}`);
const actual = {
  url: response.url,
  status: response.status,
  statusText: response.statusText,
  headers: headersToObject(response.headers),
  body: await response.text(),
};
const expect = {
  url: `${apiServer.origin}`,
  status: 200,
  statusText: "",
  headers: {
    "connection": "keep-alive",
    "content-type": "text/plain;charset=UTF-8",
    "date": assert.any(String),
    "keep-alive": assert.any(String),
    "transfer-encoding": "chunked",
  },
  body: "Hello world",
};
assert({ actual, expect });
