import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

const { buildFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  writeGeneratedFiles: true,
})
const manifest = JSON.parse(buildFileContents["other/manifest.webmanifest"])
const actual = manifest.icons
const expected = [
  {
    src: "/other/pwa.icon.png?v=574c1c76",
    sizes: "192x192",
    type: "image/png",
  },
]
assert({ actual, expected })
