/*
 * Test that js module referenced by a worker use versioned urls
 * as importmap are not supported in workers
 */

import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ snapshotsDirectoryUrl, ...rest }) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    plugins: [],
    writeGeneratedFiles: true,
    ...rest,
  })

  // 1. Snapshots
  const snapshotsContent = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({
    actual: buildFileContents,
    expected: snapshotsContent,
  })

  // 2. Ensure file executes properly
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  assert({
    actual: returnValue,
    expected: {
      ping: "pong",
      workerResponse: "pong",
    },
  })
}

// support importmap
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/importmap/", import.meta.url),
  runtimeCompat: { chrome: "89" },
})

// does not support importmap
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/systemjs/", import.meta.url),
  runtimeCompat: { chrome: "88" },
})
