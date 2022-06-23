import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

const { buildFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./elements.css": "elements.css",
  },
  bundling: true,
  minification: false,
})
const actual = {
  cssFileContent: buildFileContents["elements.css"],
}
const expected = {
  cssFileContent: `.fire {
  background: url(/other/logo.png?v=25e95a00);
}
.water {
  background: url(/other/logo2.png?v=25e95a00);
}`,
}
assert({ actual, expected })
