/*
 * The goal is to ensure the last error wins
 * and that error stack points to the file:// urls to be clickable
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
  const sourceDirectoryUrl = new URL("./client/", import.meta.url)
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  })
  const { testPlanReport } = await executeTestPlan({
    logLevel: "warn",
    logRefresh: false,
    rootDirectoryUrl: new URL("./", import.meta.url),
    testPlan: {
      "./client/main.html": {
        browser: { runtime },
      },
    },
    serverOrigin: devServer.origin,
  })
  const namespace = testPlanReport["client/main.html"].browser.namespace

  const getErrorStackLastUrl = (executionResult) => {
    const exception = executionResult.exception
    if (!exception) {
      throw new Error(
        `no error on ${runtime.name}: ${JSON.stringify(executionResult)}`,
      )
    }
    const errorStack = exception.stack
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
      namespace["/main.html@L10C5-L17C14.js"],
    ),
    errorStackLastUrl: getErrorStackLastUrl(namespace["/main.js"]),
  }

  /* eslint-disable no-regex-spaces */
  if (runtime === chromium) {
    const expected = {
      inlineErrorStackLastUrl: `${sourceDirectoryUrl}main.html:13:12`,
      errorStackLastUrl: `${sourceDirectoryUrl}main.js:3:1`,
    }
    assert({ actual, expected })
  } else if (runtime === firefox) {
    const expected = {
      // not as good as chrome but good enough for now
      inlineErrorStackLastUrl: `${sourceDirectoryUrl}main.html:12:12`,
      errorStackLastUrl: `${sourceDirectoryUrl}main.js:2:7`,
    }
    assert({ actual, expected })
  } else if (runtime === webkit) {
    const expected = {
      // not as good as chrome but good enough for now
      inlineErrorStackLastUrl: `${sourceDirectoryUrl}main.html:12:12`,
      errorStackLastUrl: `${sourceDirectoryUrl}main.js:2:7`,
    }
    assert({ actual, expected })
  }
}

if (process.platform !== "win32") {
  await test({ runtime: chromium })
  await test({ runtime: firefox })
  await test({ runtime: webkit })
}
