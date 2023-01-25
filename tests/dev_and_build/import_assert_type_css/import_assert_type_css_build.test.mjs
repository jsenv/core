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

const test = async ({ snapshotsDirectoryName, ...rest }) => {
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
  const snapshotsDirectoryUrl = new URL(
    `./snapshots/${snapshotsDirectoryName}/`,
    import.meta.url,
  )
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
  assert({ actual, expected, context: snapshotsDirectoryName })
}

// can use <script type="module">
await test({
  snapshotsDirectoryName: "js_module",
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
})
// cannot use <script type="module">
await test({
  snapshotsDirectoryName: "js_classic",
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
})
// cannot use <script type="module"> + no bundling
await test({
  snapshotsDirectoryName: "js_classic_no_bundling",
  runtimeCompat: { chrome: "60" },
})
// cannot use <script type="module"> + minification
await test({
  snapshotsDirectoryName: "js_classic_css_minified",
  runtimeCompat: { chrome: "60" },
  plugins: [
    jsenvPluginBundling(),
    jsenvPluginMinification({
      js_module: false,
      css: true,
    }),
  ],
})
