import { assert } from "@jsenv/assert";
import {
  readEntryModificationTime,
  writeEntryModificationTime,
  writeFileStructureSync,
  writeFileSync,
} from "@jsenv/filesystem";

import { fetchFileSystem } from "@jsenv/server";

import { bufferToEtag } from "@jsenv/server/src/internal/etag.js";
import { urlToFileSystemPath } from "@jsenv/urls";

if (process.platform === "win32") {
  process.exit(0);
}

const gitIgnoredDirectoryUrl = import.meta.resolve("./git_ignored/");

// 200 on file
{
  writeFileStructureSync(gitIgnoredDirectoryUrl, {});
  const fileUrl = new URL("./file.js", gitIgnoredDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);
  writeFileSync(fileUrl, fileBuffer);

  const actual = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js?ok=true",
      headers: {
        "cache-control": "no-store",
        "content-type": "text/javascript",
        "content-length": fileBuffer.length,
      },
    },
    null,
    gitIgnoredDirectoryUrl,
  );
  const expect = {
    status: 200,
    statusText: undefined,
    statusMessage: undefined,
    headers: {
      "cache-control": "no-store",
      "content-length": 14,
      "content-type": "text/javascript",
    },
    body: actual.body,
    bodyEncoding: undefined,
  };
  assert({ actual, expect });
}

// 404 if file is missing
// (skipped on windows due to EPERM failing the test)
// should likely be fixed by something like https://github.com/electron/get/pull/145/files
{
  writeFileStructureSync(gitIgnoredDirectoryUrl, {});
  const fileUrl = new URL("./toto", gitIgnoredDirectoryUrl).href;
  const actual = await fetchFileSystem(
    {
      method: "HEAD",
      resource: "/toto",
      headers: {},
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      canReadDirectory: true,
      etagEnabled: true,
      compressionEnabled: true,
      compressionSizeThreshold: 1,
    },
  );
  const expect = {
    status: 404,
    statusText: `ENOENT: File not found at ${urlToFileSystemPath(fileUrl)}`,
    statusMessage: undefined,
    headers: {
      "cache-control": "private,max-age=0,must-revalidate",
    },
    body: undefined,
    bodyEncoding: undefined,
  };
  assert({ actual, expect });
}

// 304 if file not modified (using etag)
{
  writeFileStructureSync(gitIgnoredDirectoryUrl, {});
  const fileUrl = new URL("./file.js", gitIgnoredDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);
  const fileBufferModified = Buffer.from(`const a = false`);

  writeFileSync(fileUrl, fileBuffer);
  const response = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {},
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      etagEnabled: true,
    },
  );

  {
    const actual = {
      status: response.status,
      headers: response.headers,
      body: response.body,
    };
    const expect = {
      status: 200,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
        "content-type": "text/javascript",
        "content-length": fileBuffer.length,
        "etag": bufferToEtag(fileBuffer),
      },
      body: actual.body,
    };
    assert({ actual, expect });
  }

  // do an other request with if-none-match
  const secondResponse = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {
        "if-none-match": response.headers.etag,
      },
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      etagEnabled: true,
    },
  );
  {
    const actual = {
      status: secondResponse.status,
      headers: secondResponse.headers,
    };
    const expect = {
      status: 304,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
      },
    };
    assert({ actual, expect });
  }

  // modifiy the file content, then third request
  writeFileSync(fileUrl, fileBufferModified);
  const thirdResponse = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {
        "if-none-match": response.headers.etag,
      },
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      etagEnabled: true,
    },
  );
  {
    const actual = {
      status: thirdResponse.status,
      headers: thirdResponse.headers,
    };
    const expect = {
      status: 200,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
        "content-type": "text/javascript",
        "content-length": fileBufferModified.length,
        "etag": bufferToEtag(fileBufferModified),
      },
    };
    assert({ actual, expect });
  }
}

// 304 if file not mofified (using mtime)
{
  writeFileStructureSync(gitIgnoredDirectoryUrl, {});
  const fileUrl = new URL("./file.js", gitIgnoredDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);
  writeFileSync(fileUrl, fileBuffer);
  const response = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {},
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      mtimeEnabled: true,
    },
  );
  {
    const actual = {
      status: response.status,
      headers: response.headers,
      body: response.body,
    };
    const expect = {
      status: 200,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
        "content-type": "text/javascript",
        "content-length": fileBuffer.length,
        "last-modified": new Date(
          await readEntryModificationTime(fileUrl),
        ).toUTCString(),
      },
      body: actual.body,
    };
    assert({ actual, expect });
  }

  // do an other request with if-modified-since
  const secondResponse = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {
        "if-modified-since": response.headers["last-modified"],
      },
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      mtimeEnabled: true,
    },
  );
  {
    const actual = {
      status: secondResponse.status,
      headers: secondResponse.headers,
    };
    const expect = {
      status: 304,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
      },
    };
    assert({ actual, expect });
  }

  // modifiy the file content, then third request
  await new Promise((resolve) => setTimeout(resolve, 1500)); // wait more than 1s
  await writeEntryModificationTime(fileUrl, Date.now());

  const thirdResponse = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {
        "if-modified-since": response.headers["last-modified"],
      },
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      mtimeEnabled: true,
    },
  );
  {
    const actual = {
      status: thirdResponse.status,
      headers: thirdResponse.headers,
    };
    const expect = {
      status: 200,
      headers: {
        "cache-control": "private,max-age=0,must-revalidate",
        "content-type": "text/javascript",
        "content-length": fileBuffer.length,
        "last-modified": new Date(
          await readEntryModificationTime(fileUrl),
        ).toUTCString(),
      },
    };
    assert({ actual, expect });
  }
}

// 403 on directory
{
  writeFileStructureSync(gitIgnoredDirectoryUrl, {});
  const actual = await fetchFileSystem(
    {
      method: "GET",
      resource: "/",
      headers: {},
    },
    null,
    gitIgnoredDirectoryUrl,
  );
  const expect = {
    status: 403,
    statusText: "not allowed to read directory",
  };
  assert({ actual, expect });
}

// 200 on directory when allowed
{
  const actual = await fetchFileSystem(
    {
      method: "GET",
      resource: "/",
      headers: {},
    },
    null,
    gitIgnoredDirectoryUrl,
    {
      canReadDirectory: true,
    },
  );
  const expect = {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-length": actual.headers["content-length"],
    },
    body: actual.body,
  };
  assert({ actual, expect });
}

// directory url missing
try {
  await fetchFileSystem({});
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new TypeError(
    `directoryUrl must be a string or an url, got undefined`,
  );
  assert({ actual, expect });
}

// directory url starts with http
try {
  await fetchFileSystem(
    {
      resource: "/toto.js",
    },
    null,
    "https://example.com/file.js",
  );
  throw new Error("should throw");
} catch (e) {
  const actual = e;
  const expect = new Error(
    `directoryUrl must start with "file://", got https://example.com/file.js`,
  );
  assert({ actual, expect });
}

// null on POST
{
  const actual = await fetchFileSystem(
    { resource: "/", method: "POST" },
    null,
    gitIgnoredDirectoryUrl,
  );
  const expect = null;
  assert({ actual, expect });
}
