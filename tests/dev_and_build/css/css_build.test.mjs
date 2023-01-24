import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async (params) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    writeGeneratedFiles: true,
    ...params,
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
  const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url)
  const snapshotsFileContent = readSnapshotsFromDirectory(snapshotsDirectoryUrl)
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  const actual = {
    returnValue,
    buildFileContents,
  }
  const expected = {
    returnValue: `url("${server.origin}/other/jsenv.png?v=25e95a00")`,
    buildFileContents: snapshotsFileContent,
  }
  assert({ actual, expected })
}

await test()
