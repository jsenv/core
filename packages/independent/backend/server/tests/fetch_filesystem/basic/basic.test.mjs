import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectory,
  readEntryModificationTime,
  writeEntryModificationTime,
  writeFile,
} from "@jsenv/filesystem";
import { urlToFileSystemPath } from "@jsenv/urls";

import { fetchFileSystem } from "@jsenv/server";
import { bufferToEtag } from "@jsenv/server/src/internal/etag.js";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url).href;

// 200 on file
if (process.platform !== "win32") {
  await ensureEmptyDirectory(fixturesDirectoryUrl);
  const fileUrl = new URL("./file.js", fixturesDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);
  await writeFile(fileUrl, fileBuffer);

  const actual = await fetchFileSystem(
    new URL("./file.js?ok=true", fixturesDirectoryUrl),
  );
  const expect = {
    status: 200,
    statusText: undefined,
    statusMessage: undefined,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/javascript",
      "content-length": fileBuffer.length,
    },
    body: actual.body,
    bodyEncoding: undefined,
    timing: {
      "file service>read file stat":
        actual.timing["file service>read file stat"],
    },
  };
  assert({ actual, expect });
}

// 404 if file is missing
// (skipped on windows due to EPERM failing the test)
// should likely be fixed by something like https://github.com/electron/get/pull/145/files
if (process.platform !== "win32") {
  await ensureEmptyDirectory(fixturesDirectoryUrl);
  const fileUrl = new URL("./toto", fixturesDirectoryUrl).href;

  const actual = await fetchFileSystem(
    new URL("./toto", fixturesDirectoryUrl),
    {
      method: "HEAD",
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
    timing: undefined,
  };
  assert({ actual, expect });
}

// 304 if file not modified (using etag)
if (process.platform !== "win32") {
  await ensureEmptyDirectory(fixturesDirectoryUrl);
  const fileUrl = new URL("./file.js", fixturesDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);
  const fileBufferModified = Buffer.from(`const a = false`);

  await writeFile(fileUrl, fileBuffer);
  const response = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      etagEnabled: true,
    },
  );

  {
    const actual = {
      status: response.status,
      headers: response.headers,
      body: response.body,
      timing: response.timing,
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
      timing: {
        "file service>read file stat":
          actual.timing["file service>read file stat"],
        "file service>generate file etag":
          actual.timing["file service>generate file etag"],
      },
    };
    assert({ actual, expect });
  }

  // do an other request with if-none-match
  const secondResponse = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "if-none-match": response.headers.etag,
      },
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
  await writeFile(fileUrl, fileBufferModified);
  const thirdResponse = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "if-none-match": response.headers.etag,
      },
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
if (process.platform !== "win32") {
  await ensureEmptyDirectory(fixturesDirectoryUrl);
  const fileUrl = new URL("./file.js", fixturesDirectoryUrl).href;
  const fileBuffer = Buffer.from(`const a = true`);

  await writeFile(fileUrl, fileBuffer);
  const response = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      mtimeEnabled: true,
    },
  );
  {
    const actual = {
      status: response.status,
      headers: response.headers,
      body: response.body,
      timing: response.timing,
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
      timing: {
        "file service>read file stat":
          actual.timing["file service>read file stat"],
      },
    };
    assert({ actual, expect });
  }

  // do an other request with if-modified-since
  const secondResponse = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "if-modified-since": response.headers["last-modified"],
      },
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
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "if-modified-since": response.headers["last-modified"],
      },
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
  await ensureEmptyDirectory(fixturesDirectoryUrl);
  const actual = await fetchFileSystem(fixturesDirectoryUrl);
  const expect = {
    status: 403,
    statusText: "not allowed to read directory",
  };
  assert({ actual, expect });
}

// 200 on directory when allowed
{
  const actual = await fetchFileSystem(fixturesDirectoryUrl, {
    canReadDirectory: true,
  });
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

// url missing
{
  const actual = await fetchFileSystem();
  const expect = {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": actual.headers["content-length"],
    },
    body: `fetchFileSystem first parameter must be a file url, got undefined`,
  };
  assert({ actual, expect });
}

// wrong rootDirectoryUrl
{
  const actual = await fetchFileSystem("https://example.com/file.js");
  const expect = {
    status: 500,
    headers: {
      "content-type": "text/plain",
      "content-length": actual.headers["content-length"],
    },
    body: `fetchFileSystem url must use "file://" scheme, got https://example.com/file.js`,
  };
  assert({ actual, expect });
}

// 501 on POST
{
  const actual = await fetchFileSystem(fixturesDirectoryUrl, {
    method: "POST",
  });
  const expect = {
    status: 501,
  };
  assert({ actual, expect });
}
