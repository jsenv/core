// import { createGunzip } from "zlib"
import { resolveUrl, ensureEmptyDirectory, writeFile } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { fetchFileSystem } from "@jsenv/server"

const fixturesDirectoryUrl = resolveUrl("./fixtures/", import.meta.url)

await ensureEmptyDirectory(fixturesDirectoryUrl)
{
  const fileUrl = resolveUrl("./file.js", fixturesDirectoryUrl)
  const fileBuffer = Buffer.from("const a = true")
  await writeFile(fileUrl, fileBuffer)

  const response = await fetchFileSystem(
    new URL("./file.js", fixturesDirectoryUrl),
    {
      headers: {
        "accept-encoding": "gzip",
      },
      compressionEnabled: true,
      compressionSizeThreshold: 1,
    },
  )
  const actual = {
    status: response.status,
    headers: response.headers,
    body: response.body,
    timing: response.timing,
  }
  const expected = {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/javascript",
      "content-encoding": "gzip",
      "vary": "accept-encoding",
    },
    body: actual.body,
    timing: {
      "file service>read file stat":
        actual.timing["file service>read file stat"],
    },
  }
  assert({ actual, expected })
}
await ensureEmptyDirectory(fixturesDirectoryUrl)
