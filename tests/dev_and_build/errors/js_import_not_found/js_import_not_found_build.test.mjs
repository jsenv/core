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
${new URL("./client/foo.js", import.meta.url).href}
--- url reference trace ---
${new URL("./client/intermediate.js", import.meta.url).href}:2:7
  1 | // eslint-disable-next-line import/no-unresolved
> 2 | import "./foo.js"
            ^
  3 | 
--- plugin name ---
"jsenv:file_url_fetching"`
  assert({ actual, expected })
}
