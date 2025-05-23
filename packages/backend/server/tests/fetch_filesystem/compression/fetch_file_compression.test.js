// import { createGunzip } from "zlib"
import { assert } from "@jsenv/assert";
import { ensureEmptyDirectory, writeFile } from "@jsenv/filesystem";
import { fetchFileSystem } from "@jsenv/server";

const fixturesDirectoryUrl = new URL("./fixtures/", import.meta.url).href;

await ensureEmptyDirectory(fixturesDirectoryUrl);
{
  const fileUrl = new URL("./file.js", fixturesDirectoryUrl).href;
  const fileBuffer = Buffer.from("const a = true");
  await writeFile(fileUrl, fileBuffer);

  const response = await fetchFileSystem(
    {
      method: "GET",
      resource: "/file.js",
      headers: {
        "accept-encoding": "gzip",
      },
    },
    {
      timing: () => {
        return { end: () => {} };
      },
    },
    fixturesDirectoryUrl,
    {
      compressionEnabled: true,
      compressionSizeThreshold: 1,
    },
  );
  const actual = {
    status: response.status,
    headers: response.headers,
    body: response.body,
  };
  const expect = {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/javascript",
      "content-encoding": "gzip",
      "vary": "accept-encoding",
    },
    body: actual.body,
  };
  assert({ actual, expect });
}
await ensureEmptyDirectory(fixturesDirectoryUrl);
