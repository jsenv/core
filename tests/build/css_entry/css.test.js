import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

const { buildFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.css": "main.css",
  },
  bundling: true,
  minification: true,
})
const actual = {
  mainCssFileContent: buildFileContents["main.css"],
}
const expected = {
  mainCssFileContent: `body{filter:url(#better-blur);background:url(/other/jsenv.png?v=25e95a00) 100% 100% no-repeat,url(/other/jsenv.png?v=25e95a00)}`,
}
assert({ actual, expected })
