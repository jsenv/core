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
      endpoint: "GET /",
      fetch: createFileSystemFetch(testDirectoryUrl, {
        directoryMainFileRelativeUrl: "index.html",
      }),
    },
  ],
});

// GET / -> receives index.html
{
  const response = await fetchUrl(new URL("/", server.origin).href);
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
  const indexHtmlContent = readFileSync(
    new URL(import.meta.resolve("./fixtures/index.html")),
    "utf8",
  );
  const expect = {
    status: 200,
    contentType: "text/html",
    body: indexHtmlContent,
  };
  assert({ actual, expect });
}

// GET /index.html -> receives index.html
{
  const response = await fetchUrl(new URL("/index.html", server.origin).href);
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

// GET /file.txt -> receives file.txt
{
  const response = await fetchUrl(new URL("/file.txt", server.origin).href);
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
  const expect = {
    status: 200,
    contentType: "text/plain",
    body: "Hello from file.txt\n",
  };
  assert({ actual, expect });
}

// GET /toto.js -> receives 404
{
  const response = await fetchUrl(new URL("/toto.js", server.origin).href, {
    redirect: "manual",
  });
  const actual = {
    status: response.status,
  };
  const expect = {
    status: 404,
  };
  assert({ actual, expect });
}

// GET /subdir/ -> 403 because canReadDirectory is false
{
  const response = await fetchUrl(new URL("/subdir/", server.origin).href);
  const actual = {
    status: response.status,
  };
  const expect = {
    status: 403,
  };
  assert({ actual, expect });
}

// GET /subdir/b.js -> receives b.js
{
  const response = await fetchUrl(new URL("/subdir/b.js", server.origin).href);
  const actual = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
  const expect = {
    status: 200,
    contentType: "text/javascript",
    body: readFileSync(
      new URL(import.meta.resolve("./fixtures/subdir/b.js")),
      "utf8",
    ),
  };
  assert({ actual, expect });
}
