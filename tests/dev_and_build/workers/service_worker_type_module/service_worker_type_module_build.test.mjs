import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async ({
  snapshotsDirectoryUrl,
  expectedServiceWorkerUrls,
  ...rest
}) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    ...rest,
    plugins: [...(rest.plugins || [])],
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
  const { serviceWorkerUrls } = returnValue.inspectResponse

  const expectedBuildFileContents = readSnapshotsFromDirectory(
    snapshotsDirectoryUrl,
  )
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({
    actual: {
      serviceWorkerUrls,
      buildFileContents,
    },
    expected: {
      serviceWorkerUrls: expectedServiceWorkerUrls,
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
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "11f11490" },
      "/css/style.css?v=0e312da1": { versioned: true },
    },
  })
  // support + no bundling
  await test({
    runtimeCompat: { chrome: "80" },
    snapshotsDirectoryUrl: new URL("./snapshots/2/", import.meta.url),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "11f11490" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.nomodule.js?v=8345fcfc": { versioned: true },
      "/js/b.nomodule.js?v=8f3fa8a4": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker
  await test({
    runtimeCompat: { chrome: "79" },
    plugins: [jsenvPluginBundling()],
    snapshotsDirectoryUrl: new URL("./snapshots/3/", import.meta.url),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "c92ad1aa" },
      "/css/style.css?v=0e312da1": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker + no bundling
  await test({
    runtimeCompat: { chrome: "79" },
    snapshotsDirectoryUrl: new URL("./snapshots/4/", import.meta.url),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "c92ad1aa" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.nomodule.js?v=8345fcfc": { versioned: true },
      "/js/b.nomodule.js?v=8f3fa8a4": { versioned: true },
    },
  })
}
