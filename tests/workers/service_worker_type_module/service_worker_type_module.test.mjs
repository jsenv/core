import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { executeInChromium } from "@jsenv/core/tests/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    ...params,
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
  return returnValue.inspectResponse
}

if (process.platform === "darwin") {
  // no support for {type: "module"} on service worker
  {
    const actual = await test({ runtimeCompat: { chrome: "79" } })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "2628245b" },
        "/css/style.css?v=65c914e7": { versioned: true },
        "/js/babel_helpers.nomodule.js?as_js_classic&v=10e40f65": {
          versioned: true,
        },
      },
    }
    assert({ actual, expected })
  }

  // no support for {type: "module"} on service worker + no bundling
  {
    const actual = await test({
      runtimeCompat: { chrome: "79" },
      bundling: false,
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "2628245b" },
        "/css/style.css?v=65c914e7": { versioned: true },
        "/js/slicedToArray.nomodule.js?as_js_classic&v=53e5516f": {
          versioned: true,
        },
        "/js/a.nomodule.js?as_js_classic&v=217fbe28": { versioned: true },
        "/js/arrayWithHoles.nomodule.js?as_js_classic&v=267e2ee6": {
          versioned: true,
        },
        "/js/iterableToArrayLimit.nomodule.js?as_js_classic&v=1d093038": {
          versioned: true,
        },
        "/js/unsupportedIterableToArray.nomodule.js?as_js_classic&v=5b78d393": {
          versioned: true,
        },
        "/js/nonIterableRest.nomodule.js?as_js_classic&v=bbc3b8e9": {
          versioned: true,
        },
        "/js/b.nomodule.js?as_js_classic&v=5d37f892": { versioned: true },
        "/js/arrayLikeToArray.nomodule.js?as_js_classic&v=3ba77d54": {
          versioned: true,
        },
      },
    }
    assert({ actual, expected })
  }

  // support
  {
    const actual = await test({ runtimeCompat: { chrome: "80" } })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "876aac63" },
        "/css/style.css?v=65c914e7": { versioned: true },
        "/js/babel_helpers.js?v=27bcc5e3": { versioned: true },
      },
    }
    assert({ actual, expected })
  }

  // support + no bundling
  {
    const actual = await test({
      runtimeCompat: { chrome: "80" },
      bundling: false,
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "876aac63" },
        "/css/style.css?v=65c914e7": { versioned: true },
        "/js/slicedToArray.js?v=5463c7ac": { versioned: true },
        "/js/a.js?v=74e8b097": { versioned: true },
        "/js/arrayWithHoles.js?v=f6e7da9b": { versioned: true },
        "/js/iterableToArrayLimit.js?v=0438f76f": { versioned: true },
        "/js/unsupportedIterableToArray.js?v=163b7fa1": { versioned: true },
        "/js/nonIterableRest.js?v=3323b0da": { versioned: true },
        "/js/b.js?v=e3b0c442": { versioned: true },
        "/js/arrayLikeToArray.js?v=68e4b487": { versioned: true },
      },
    }
    assert({ actual, expected })
  }
}
