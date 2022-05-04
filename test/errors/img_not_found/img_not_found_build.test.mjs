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
${urlToFileSystemPath(new URL("./client/main.html", import.meta.url).href)}:9:10
  8  |   <body>
> 9  |     <img src="./img.png" />
                ^
  10 |   </body>
--- plugin name ---
"jsenv:fetch_file_urls"`
  assert({ actual, expected })
}
