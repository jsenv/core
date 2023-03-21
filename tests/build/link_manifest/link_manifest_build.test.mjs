import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"

const { buildFileContents } = await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "main.html",
  },
  writeGeneratedFiles: true,
})
const { start_url, icons } = JSON.parse(
  buildFileContents["other/manifest.webmanifest"],
)
const actual = {
  start_url,
  icons,
}
const expected = {
  start_url: "/",
  icons: [
    {
      src: "/other/pwa.icon.png?v=574c1c76",
      sizes: "192x192",
      type: "image/png",
    },
  ],
}
assert({ actual, expected })
