/*
 * The goal is to ensure the last error wins
 * and that error stack points to the file:// urls to be clickable
 * TODO
 * - test on firefox
 * - update @jsenv/assert to replace --- at --- by --- path ---
 */

import { assert } from "@jsenv/assert"

import {
  startDevServer,
  executeTestPlan,
  chromium,
  firefox,
  webkit,
} from "@jsenv/core"

const test = async ({ runtime }) => {
  const rootDirectoryUrl = new URL("./client/", import.meta.url)
  const devServer = await startDevServer({
    logLevel: "warn",
    rootDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  })
  const { testPlanReport } = await executeTestPlan({
    logLevel: "warn",
    rootDirectoryUrl,
    devServerOrigin: devServer.origin,
    testPlan: {
      "./main.html": {
        browser: { runtime },
      },
    },
  })
  const namespace = testPlanReport["main.html"].browser.namespace

  const getErrorStackLastUrl = (errorStack) => {
    const regex = {
      // eslint-disable-next-line no-regex-spaces
      chromium: /    at (.+)$/gm,
      firefox: /@(file:.+)/gm,
      webkit: /@(file:.+)/gm,
    }[runtime.name]
    const match = errorStack.match(regex)
    if (!match) {
      throw new Error(
        `unexpected error stack on ${runtime.name}: ${errorStack}`,
      )
    }
    const lastUrl = match[match.length - 1]
    if (runtime.name === "firefox" || runtime.name === "webkit") {
      return lastUrl.slice("@".length)
    }
    return lastUrl.slice("    at ".length)
  }
  const actual = {
    inlineErrorStackLastUrl: getErrorStackLastUrl(
      namespace["/main.html@L10C5-L17C14.js"].error,
    ),
    errorStackLastUrl: getErrorStackLastUrl(namespace["/main.js"].error),
  }

  /* eslint-disable no-regex-spaces */
  if (runtime === chromium) {
    const expected = {
      inlineErrorStackLastUrl: `${rootDirectoryUrl}main.html:13:12`,
      errorStackLastUrl: `${rootDirectoryUrl}main.js:3:1`,
    }
    assert({ actual, expected })
  } else if (runtime === firefox) {
    const expected = {
      // not as good as chrome but good enough for now
      inlineErrorStackLastUrl: `${rootDirectoryUrl}main.html:12:12`,
      errorStackLastUrl: `${rootDirectoryUrl}main.js:3:7`,
    }
    assert({ actual, expected })
  } else if (runtime === webkit) {
    const expected = {
      // not as good as chrome but good enough for now
      inlineErrorStackLastUrl: `${rootDirectoryUrl}main.html:12:12`,
      errorStackLastUrl: `${rootDirectoryUrl}main.js:3:7`,
    }
    assert({ actual, expected })
  }
}

if (process.platform !== "win32") {
  await test({ runtime: chromium })
  await test({ runtime: firefox })
  // await test({ runtime: webkit })
}
