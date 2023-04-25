import { assert } from "@jsenv/assert"
import { build } from "@jsenv/core"
import {
  writeSnapshotsIntoDirectory,
  readSnapshotsFromDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

const test = async ({ name, ...rest }) => {
  const snapshotsDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url)
  const { buildFileContents } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    runtimeCompat: { chrome: "90" },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  })
  const expected = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  const actual = buildFileContents
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({ actual, expected })
}

await test({
  name: "chunks_default",
  plugins: [jsenvPluginBundling()],
})

// await test({
//   name: "chunks_vendors",
//   plugins: [
//     jsenvPluginBundling({
//       js_module: {
//         chunks: {
//           vendors: {
//             "file://**/node_modules/": true,
//             "./a.js": true,
//           },
//         },
//       },
//     }),
//   ],
// })
