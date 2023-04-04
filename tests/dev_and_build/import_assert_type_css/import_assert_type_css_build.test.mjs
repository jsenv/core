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
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
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

// chrome 60 cannot use <script type="module"> nor constructable stylesheet
await test({
  snapshotsDirectoryName: "chrome_60",
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
})
// chrome 60 + no bundling
await test({
  snapshotsDirectoryName: "chrome_60_no_bundling",
  runtimeCompat: { chrome: "60" },
  plugins: [],
})
// chrome 88 has constructables stylesheet
// but cannot use js modules due to versioning via importmap (as it does not have importmap)
await test({
  snapshotsDirectoryName: "chrome_88_css_minified",
  runtimeCompat: { chrome: "88" },
  plugins: [
    jsenvPluginBundling(),
    jsenvPluginMinification({
      js_module: false,
      js_classic: false,
      css: true,
    }),
  ],
})
// chrome 89 can use js modules
await test({
  snapshotsDirectoryName: "chrome_89",
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
})
