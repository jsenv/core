import { build } from "@jsenv/core"
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic"

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [jsenvPluginBundling(), jsenvPluginAsJsClassic()],
    versioning: false,
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  })
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL("./snapshots/", import.meta.url),
  )
}

// support for <script type="module">
await test({
  runtimeCompat: { chrome: "89" },
})
