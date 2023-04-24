import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async (params) => {
  const snapshotDirectoryContent = readSnapshotsFromDirectory(
    new URL("./snapshots/build/", import.meta.url),
  )
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    plugins: [],
    versioning: false,
    ...params,
  })
  const distDirectoryContent = readSnapshotsFromDirectory(
    new URL("./dist/", import.meta.url),
  )
  writeSnapshotsIntoDirectory(
    new URL("./snapshots/build/", import.meta.url),
    distDirectoryContent,
  )
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const actual = {
    returnValue,
    snapshots: distDirectoryContent,
  }
  const expected = {
    returnValue: 42,
    snapshots: snapshotDirectoryContent,
  }
  assert({ actual, expected })
}

// support for <script type="module">
await test({ runtimeCompat: { chrome: "89" } })
