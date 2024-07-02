import { assert } from "@jsenv/assert";
import { writeFile, ensureEmptyDirectory } from "@jsenv/filesystem";
import { urlToFileSystemPath } from "@jsenv/urls";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";
import { startServer } from "@jsenv/server";

import { fetchUrl } from "@jsenv/fetch";

const tempDirectoryUrl = new URL("./temp/", import.meta.url).href;

// fetch text file
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const url = new URL("file.txt", tempDirectoryUrl).href;
  const fileContent = "hello world";
  await writeFile(url, fileContent);

  const response = await fetchUrl(url, {
    headers: { "cache-control": "no-cache" },
  });
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url,
    status: 200,
    statusText: "",
    headers: {
      "cache-control": "no-store",
      "content-length": `${fileContent.length}`,
      "content-type": "text/plain",
    },
    body: fileContent,
  };
  assert({ actual, expect });
}

// fetching data url
{
  const jsData = `const a = true;`;
  const jsBase64 = Buffer.from(jsData).toString("base64");
  const url = `data:text/javascript;base64,${jsBase64}`;
  const response = await fetchUrl(url);
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url,
    status: 200,
    statusText: "",
    headers: {
      "content-type": "text/javascript",
    },
    body: jsData,
  };
  assert({ actual, expect });
}

// fetch file but 404
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const url = new URL("file.txt", tempDirectoryUrl).href;

  const response = await fetchUrl(url, {
    headers: { "cache-control": "no-cache" },
  });
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url,
    status: 404,
    statusText: `ENOENT: File not found at ${urlToFileSystemPath(url)}`,
    headers: {
      "cache-control": "no-store",
    },
    body: "",
  };
  assert({ actual, expect });
}

// fetching http
{
  const body = "Hello world";
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: ({ method }) => {
          if (method !== "POST") return null;

          return {
            status: 201,
            headers: {
              "content-type": "text/plain",
              "content-length": body.length,
            },
            body,
          };
        },
      },
    ],
  });
  const url = server.origin;

  const response = await fetchUrl(url, { method: "POST" });
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  };
  const expect = {
    url: `${url}/`,
    status: 201,
    statusText: "Created",
    headers: {
      "connection": "keep-alive",
      "content-length": `${body.length}`,
      "content-type": "text/plain",
      "date": actual.headers.date,
      "keep-alive": "timeout=5",
    },
    body,
  };
  assert({ actual, expect });
  await server.stop();
}

// cancel while fetching http
{
  await ensureEmptyDirectory(tempDirectoryUrl);
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 2000).unref();
          });
        },
      },
    ],
  });
  const url = server.origin;
  const abortController = new AbortController();

  try {
    setTimeout(() => {
      abortController.abort();
    }, 100);
    await fetchUrl(url, {
      signal: abortController.signal,
      headers: { "cache-control": "no-cache" },
    });
    throw new Error("should throw");
  } catch (error) {
    const actual = error.name;
    const expect = "AbortError";
    assert({ actual, expect });
  }
}
