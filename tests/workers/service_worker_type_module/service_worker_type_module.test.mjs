import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async ({ expectedServiceWorkerUrls, ...rest }) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
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
  assert({ actual: serviceWorkerUrls, expected: expectedServiceWorkerUrls })
}

if (process.platform === "darwin") {
  // support
  await test({
    runtimeCompat: { chrome: "80" },
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "d7e3da44" },
      "/css/style.css?v=bd38451d": { versioned: true },
    },
  })
  // support + no bundling
  await test({
    runtimeCompat: { chrome: "80" },
    bundling: false,
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "8229433b" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.js?v=e9a31140": { versioned: true },
      "/js/b.js?v=e3b0c442": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker
  await test({
    runtimeCompat: { chrome: "79" },
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "a03ed51d" },
      "/css/style.css?v=bd38451d": { versioned: true },
    },
  })
  // no support for { type: "module" } on service worker + no bundling
  await test({
    runtimeCompat: { chrome: "79" },
    bundling: false,
    expectedServiceWorkerUrls: {
      "/main.html": { versioned: false, version: "419f728b" },
      "/css/style.css?v=0e312da1": { versioned: true },
      "/js/a.nomodule.js?v=340fe042": { versioned: true },
      "/js/b.nomodule.js?v=8f3fa8a4": { versioned: true },
    },
  })
}
