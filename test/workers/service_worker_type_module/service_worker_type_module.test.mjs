import { assert } from "@jsenv/assert"

import { build } from "@jsenv/core"
import { startFileServer } from "@jsenv/core/test/start_file_server.js"
import { executeInChromium } from "@jsenv/core/test/execute_in_chromium.js"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
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
  // no support
  {
    const actual = await test({
      runtimeCompat: {
        chrome: "79",
      },
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": {
          versioned: false,
          version: "39280516",
        },
        "/css/style.css?v=0e312da1": {
          versioned: true,
        },
      },
    }
    assert({ actual, expected })
  }

  // no support + no bundling
  {
    const actual = await test({
      runtimeCompat: {
        chrome: "79",
      },
      bundling: false,
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "39280516" },
        "/css/style.css?v=0e312da1": { versioned: true },
        "/js/slicedToArray.es5.js?as_js_classic&v=ecc85f1b": {
          versioned: true,
        },
        "/js/a.es5.js?as_js_classic&v=5c7a9128": { versioned: true },
        "/js/arrayWithHoles.es5.js?as_js_classic&v=0a290ff6": {
          versioned: true,
        },
        "/js/iterableToArrayLimit.es5.js?as_js_classic&v=76b16a47": {
          versioned: true,
        },
        "/js/unsupportedIterableToArray.es5.js?as_js_classic&v=bed8004c": {
          versioned: true,
        },
        "/js/nonIterableRest.es5.js?as_js_classic&v=ad6c6282": {
          versioned: true,
        },
        "/js/b.es5.js?as_js_classic&v=8f3fa8a4": { versioned: true },
        "/js/arrayLikeToArray.es5.js?as_js_classic&v=fbb6cf02": {
          versioned: true,
        },
      },
    }
    assert({ actual, expected })
  }

  // support
  {
    const actual = await test({
      runtimeCompat: {
        chrome: "80",
      },
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": {
          versioned: false,
          version: "0667abfe",
        },
        "/css/style.css?v=0e312da1": {
          versioned: true,
        },
      },
    }
    assert({ actual, expected })
  }

  // support + no bundling
  {
    const actual = await test({
      runtimeCompat: {
        chrome: "80",
      },
      bundling: false,
    })
    const expected = {
      order: [],
      serviceWorkerUrls: {
        "/main.html": { versioned: false, version: "0667abfe" },
        "/css/style.css?v=0e312da1": { versioned: true },
        "/js/slicedToArray.js?v=615f0b28": { versioned: true },
        "/js/a.js?v=ad0057dc": { versioned: true },
        "/js/arrayWithHoles.js?v=f4a3cd3b": { versioned: true },
        "/js/iterableToArrayLimit.js?v=2b6b9d86": { versioned: true },
        "/js/unsupportedIterableToArray.js?v=e025c8eb": { versioned: true },
        "/js/nonIterableRest.js?v=de8e7134": { versioned: true },
        "/js/b.js?v=e3b0c442": { versioned: true },
        "/js/arrayLikeToArray.js?v=016e8c90": { versioned: true },
      },
    }
    assert({ actual, expected })
  }
}
