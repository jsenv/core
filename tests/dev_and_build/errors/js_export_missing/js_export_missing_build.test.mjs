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
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `"answer" is not exported by "tests/dev_and_build/errors/js_export_missing/client/file.js", imported by "tests/dev_and_build/errors/js_export_missing/client/main.js".
--- frame ---
1: // eslint-disable-next-line import/named
2: import { answer } from "${
    new URL("./client/file.js", import.meta.url).href
  }";
            ^
3: console.log(answer);`
  assert({ actual, expected })
}
