// import { createGunzip } from "zlib"
import { ensureEmptyDirectory, writeFile } from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";

import { fetchFileSystem } from "@jsenv/server";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url).href;

await ensureEmptyDirectory(fixturesDirectoryUrl);
{
  const fileUrl = new URL("./file.js", fixturesDirectoryUrl).href;
  const fileBuffer = Buffer.from("const a = true");
  await writeFile(fileUrl, fileBuffer);

  const response = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "accept-encoding": "gzip",
      },
      compressionEnabled: true,
      compressionSizeThreshold: 1,
    },
  );
  const actual = {
    status: response.status,
    headers: response.headers,
    body: response.body,
    timing: response.timing,
  };
  const expected = {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/javascript",
      "content-encoding": "gzip",
      "vary": "accept-encoding",
    },
    body: actual.body,
    timing: {
      "file service>read file stat":
        actual.timing["file service>read file stat"],
    },
  };
  assert({ actual, expected });
}
await ensureEmptyDirectory(fixturesDirectoryUrl);
