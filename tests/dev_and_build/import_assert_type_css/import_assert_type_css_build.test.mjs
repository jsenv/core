import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginMinification } from "@jsenv/plugin-minification"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async ({ snapshotsDirectoryUrl, ...rest }) => {
  const { buildFileContents, buildManifest } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    ...rest,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const snapshotsFileContent = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  const actual = {
    snapshotsFileContent,
    returnValue,
  }
  const expected = {
    snapshotsFileContent: buildFileContents,
    returnValue: {
      bodyBackgroundColor: "rgb(255, 0, 0)",
      bodyBackgroundImage: `url("${server.origin}/${buildManifest["other/jsenv.png"]}")`,
    },
  }
  assert({ actual, expected })
}

// can use <script type="module">
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/js_module/", import.meta.url),
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
})
// can use <script type="module"> + no bundling
// await test({
//   snapshotsDirectoryUrl: new URL(
//     "./snapshots/js_module_no_bundling/",
//     import.meta.url,
//   ),
//   runtimeCompat: { chrome: "65" },
// })
// // can use <script type="module"> + minification
// await test({
//   snapshotsDirectoryUrl: new URL(
//     "./snapshots/js_module_css_minified/",
//     import.meta.url,
//   ),
//   runtimeCompat: { chrome: "60" },
//   plugins: [
//     jsenvPluginBundling(),
//     jsenvPluginMinification({
//       js_module: false,
//       css: true,
//     }),
//   ],
// })
// // cannot use <script type="module">
// await test({
//   snapshotsDirectoryUrl: new URL("./snapshots/systemjs/", import.meta.url),
//   runtimeCompat: { chrome: "60" },
//   plugins: [jsenvPluginBundling()],
// })
