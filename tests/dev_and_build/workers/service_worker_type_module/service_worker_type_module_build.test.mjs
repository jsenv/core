import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async ({
  snapshotsDirectoryUrl,
  expectedResourcesFromJsenvBuild,
  ...rest
}) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    ...rest,
    plugins: [...(rest.plugins || [])],
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  })
  const { resourcesFromJsenvBuild } = returnValue.inspectResponse

  const expectedBuildFileContents = readSnapshotsFromDirectory(
    snapshotsDirectoryUrl,
  )
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({
    actual: {
      resourcesFromJsenvBuild,
      buildFileContents,
    },
    expected: {
      resourcesFromJsenvBuild: expectedResourcesFromJsenvBuild,
      buildFileContents: expectedBuildFileContents,
    },
  })
}

if (process.platform === "darwin") {
  // support + bundling
  await test({
    runtimeCompat: { chrome: "80" },
    plugins: [jsenvPluginBundling()],
    snapshotsDirectoryUrl: new URL("./snapshots/1/", import.meta.url),
    expectedResourcesFromJsenvBuild: {
      "/main.html": { version: "f5eb87e5" },
      "/css/style.css": {
        version: "0e312da1",
        versionedUrl: "/css/style.css?v=0e312da1",
      },
    },
  })
  // support + no bundling
  await test({
    runtimeCompat: { chrome: "80" },
    snapshotsDirectoryUrl: new URL("./snapshots/2/", import.meta.url),
    expectedResourcesFromJsenvBuild: {
      "/main.html": { version: "f5eb87e5" },
      "/css/style.css": {
        version: "0e312da1",
        versionedUrl: "/css/style.css?v=0e312da1",
      },
      "/js/a.nomodule.js": {
        version: "8345fcfc",
        versionedUrl: "/js/a.nomodule.js?v=8345fcfc",
      },
      "/js/b.nomodule.js": {
        version: "8f3fa8a4",
        versionedUrl: "/js/b.nomodule.js?v=8f3fa8a4",
      },
    },
  })
  // no support for { type: "module" } on service worker
  await test({
    runtimeCompat: { chrome: "79" },
    plugins: [jsenvPluginBundling()],
    snapshotsDirectoryUrl: new URL("./snapshots/3/", import.meta.url),
    expectedResourcesFromJsenvBuild: {
      "/main.html": { version: "0f58deaa" },
      "/css/style.css": {
        version: "0e312da1",
        versionedUrl: "/css/style.css?v=0e312da1",
      },
    },
  })
  // no support for { type: "module" } on service worker + no bundling
  await test({
    runtimeCompat: { chrome: "79" },
    snapshotsDirectoryUrl: new URL("./snapshots/4/", import.meta.url),
    expectedResourcesFromJsenvBuild: {
      "/main.html": { version: "0f58deaa" },
      "/css/style.css": {
        version: "0e312da1",
        versionedUrl: "/css/style.css?v=0e312da1",
      },
      "/js/a.nomodule.js": {
        version: "8345fcfc",
        versionedUrl: "/js/a.nomodule.js?v=8345fcfc",
      },
      "/js/b.nomodule.js": {
        version: "8f3fa8a4",
        versionedUrl: "/js/b.nomodule.js?v=8f3fa8a4",
      },
    },
  })
}
