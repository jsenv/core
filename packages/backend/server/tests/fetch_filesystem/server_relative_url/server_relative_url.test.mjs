import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";
import { createFileSystemFetch, startServer } from "@jsenv/server";
import { readFileSync } from "node:fs";

const testDirectoryUrl = import.meta.resolve("./fixtures/");
const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  routes: [
    {
      endpoint: "GET /public/",
      fetch: createFileSystemFetch(testDirectoryUrl, {
        directoryMainFileRelativeUrl: "index.html",
      }),
    },
  ],
});

// GET /public/ -> receives index.html
{
  const response = await fetchUrl(new URL("/public/", server.origin).href);
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
  };
  const expect = {
    status: 200,
    contentType: "text/html",
  };
  assert({ actual, expect });
}

// GET /public/file.txt -> receives file.txt
{
  const response = await fetchUrl(
    new URL("/public/file.txt", server.origin).href,
  );
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
  const expect = {
    status: 200,
    contentType: "text/plain",
    body: readFileSync(
      new URL(import.meta.resolve("./fixtures/file.txt")),
      "utf8",
    ),
  };
  assert({ actual, expect });
}

// GET / -> 404 (outside the /public/ route)
{
  const response = await fetchUrl(new URL("/", server.origin).href);
  const actual = {
    status: response.status,
  };
  const expect = {
    status: 404,
  };
  assert({ actual, expect });
}
