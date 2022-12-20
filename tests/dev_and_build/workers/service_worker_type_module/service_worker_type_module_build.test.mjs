import { assert } from "@jsenv/assert"
import { jsenvPluginMinification } from "@jsenv/plugin-minification"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"
import { readDirectoryContent } from "@jsenv/core/tests/read_directory_content.js"

const test = async ({
  expectedBuildFileContents,
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
    plugins: [
      jsenvPluginMinification({
        // minify js classic to ensure version is predictable
        // otherwise it's filesystem dependents because of systemjs infering variables
        // name from import path
        // see "something to keep in mind" inside "jsenv_plugin_as_js_classic.js"
        html: false,
        css: false,
        js_module: false,
        js_classic: true,
      }),
    ],
    ...rest,
  })
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const { returnValue } = await executeInChromium({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async () => {
      return window.resultPromise
    },
    /* eslint-enable no-undef */
  })
  const { serviceWorkerUrls } = returnValue.inspectResponse

  assert({
    actual: {
      buildFileContents,
      serviceWorkerUrls,
    },
    expected: {
      buildFileContents: expectedBuildFileContents,
      serviceWorkerUrls: expectedServiceWorkerUrls,
    },
  })
}

if (process.platform === "darwin") {
  // support
  await test({
    runtimeCompat: { chrome: "80" },
    expectedBuildFileContents: readDirectoryContent(
      new URL("./expected/1/", import.meta.url),
    ),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "1985706b" },
      "/css/style.css?v=bd38451d": { versioned: true },
    },
  })
  // support + no bundling
  await test({
    runtimeCompat: { chrome: "80" },
    bundling: false,
    expectedBuildFileContents: readDirectoryContent(
      new URL("./expected/2/", import.meta.url),
    ),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "1ee5fe50" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.js?v=9c2ce306": { versioned: true },
      "/js/b.js?v=e3b0c442": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker
  await test({
    runtimeCompat: { chrome: "79" },
    expectedBuildFileContents: readDirectoryContent(
      new URL("./expected/3/", import.meta.url),
    ),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "64ccea8c" },
      "/css/style.css?v=bd38451d": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker + no bundling
  await test({
    runtimeCompat: { chrome: "79" },
    bundling: false,
    expectedBuildFileContents: readDirectoryContent(
      new URL("./expected/4/", import.meta.url),
    ),
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "0f66748c" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.nomodule.js?v=9f69cb0f": { versioned: true },
      "/js/b.nomodule.js?v=5d37f892": { versioned: true },
    },
  })
}
