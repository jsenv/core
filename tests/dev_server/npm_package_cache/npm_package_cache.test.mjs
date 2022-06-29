import { writeFileSync, readFileSync, utimesSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"

const debug = false // true to have browser UI + keep it open after test
const fooPackageFileUrl = new URL(
  "./client/node_modules/foo/package.json",
  import.meta.url,
)
const fooPackageFileContent = {
  beforeTest: readFileSync(fooPackageFileUrl),
  update: (content) => writeFileSync(fooPackageFileUrl, content),
  restore: () =>
    writeFileSync(fooPackageFileUrl, fooPackageFileContent.beforeTest),
}
const fooMainFileUrl = new URL(
  "./client/node_modules/foo/index.js",
  import.meta.url,
)
const fooMainFileContent = {
  beforeTest: readFileSync(fooMainFileUrl),
  update: (content) => writeFileSync(fooMainFileUrl, content),
  restore: () => writeFileSync(fooMainFileUrl, fooMainFileContent.beforeTest),
}
const serverRequests = []
const devServer = await startDevServer({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  serverPlugins: {
    spy_request: {
      onRequest: (request) => {
        serverRequests.push(request)
      },
    },
  },
  clientAutoreload: false,
  htmlSupervisor: false,
})
const browser = await chromium.launch({
  headless: !debug,
})
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${devServer.origin}/src/main.html`)
  const getResult = async () => {
    const result = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return window.resultPromise
      },
      /* eslint-enable no-undef */
    )
    return result
  }
  const getServerRequestedForFoo = () => {
    return serverRequests.some((request) => {
      // We don't see "?v=1.0.0" because we check request.pathname
      // We could use request.ressource to see it but it's not the purpose of this test
      // to test how it's done. Here we just want to ensure it's cached/uncached
      return request.pathname === "/node_modules/foo/index.js"
    })
  }

  {
    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    }
    const expected = {
      result: 42,
      serverRequestedForFoo: true,
    }
    assert({ actual, expected })
  }

  // reload page and expect node_modules/foo/index.js to be cached
  // without server request
  {
    serverRequests.length = 0
    await page.reload()
    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    }
    const expected = {
      result: 42,
      serverRequestedForFoo: false,
    }
    assert({ actual, expected })
  }

  // now update the package content + version and see if reloading the page updates the result
  {
    serverRequests.length = 0
    fooMainFileContent.update(`export const answer = 43`)
    fooPackageFileContent.update(
      JSON.stringify({
        name: "foo",
        private: true,
        version: "1.0.1",
      }),
    )
    utimesSync(
      new URL("./client/package.json", import.meta.url),
      new Date(),
      new Date(),
    )
    // await new Promise((resolve) => setTimeout(resolve, 500))
    await page.reload()

    const actual = {
      result: await getResult(),
      serverRequestedForFoo: getServerRequestedForFoo(),
    }
    const expected = {
      result: 43,
      serverRequestedForFoo: true,
    }
    assert({ actual, expected })
  }
} finally {
  if (!debug) {
    browser.close()
  }
  fooPackageFileContent.restore()
  fooMainFileContent.restore()
}
