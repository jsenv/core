import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"

const test = async ({ snapshotsDirectoryUrl, ...rest }) => {
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
  const expectedBuildFileContents = readSnapshotsFromDirectory(
    snapshotsDirectoryUrl,
  )
  writeSnapshotsIntoDirectory(snapshotsDirectoryUrl, buildFileContents)
  assert({
    actual: buildFileContents,
    expected: expectedBuildFileContents,
  })
}

if (process.platform === "darwin") {
  // support + bundling
  await test({
    runtimeCompat: { chrome: "80" },
    plugins: [jsenvPluginBundling()],
    snapshotsDirectoryUrl: new URL("./snapshots/1/", import.meta.url),
  })
  // support + no bundling
  await test({
    runtimeCompat: { chrome: "80" },
    snapshotsDirectoryUrl: new URL("./snapshots/2/", import.meta.url),
  })
  // no support for { type: "module" } on service worker
  await test({
    runtimeCompat: { chrome: "79" },
    plugins: [jsenvPluginBundling()],
    snapshotsDirectoryUrl: new URL("./snapshots/3/", import.meta.url),
  })
  // no support for { type: "module" } on service worker + no bundling
  await test({
    runtimeCompat: { chrome: "79" },
    snapshotsDirectoryUrl: new URL("./snapshots/4/", import.meta.url),
  })
}
