import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

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
    plugins: [jsenvPluginBundling()],
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
  const { order, resourcesFromJsenvBuild } = returnValue.inspectResponse
  const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url)
  const expectedBuildFileContents = readSnapshotsFromDirectory(
    snapshotsDirectoryUrl,
  )
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)

  const actual = {
    order,
    resourcesFromJsenvBuild,
    buildFileContents,
  }
  const expected = {
    order: ["before-a", "before-b", "b", "after-b", "after-a"],
    resourcesFromJsenvBuild: {
      "/main.html": { version: "f78edba7" },
      "/css/style.css": {
        version: "0e312da1",
        versionedUrl: "/css/style.css?v=0e312da1",
      },
      "/js/a.js": {
        version: "766d14d0",
        versionedUrl: "/js/a.js?v=766d14d0",
      },
      "/js/b.js": {
        version: "2cc2d9e4",
        versionedUrl: "/js/b.js?v=2cc2d9e4",
      },
    },
    buildFileContents: expectedBuildFileContents,
  }
  assert({ actual, expected })
}

if (process.platform === "darwin") {
  await test()
}
