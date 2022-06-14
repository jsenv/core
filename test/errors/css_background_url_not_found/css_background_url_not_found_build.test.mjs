import { urlToFileSystemPath } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

try {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `Failed to fetch url content
--- reason ---
no entry on filesystem
--- url ---
${new URL("./client/img.png", import.meta.url).href}
--- url reference trace ---
${urlToFileSystemPath(new URL("./client/style.css", import.meta.url).href)}:2:25
  1 | body {
> 2 |   background-image: url("./img.png");
                              ^
  3 | }
--- plugin name ---
"jsenv:file_url_fetching"`
  assert({ actual, expected })
}
