/*
 * 1. When importmap are supported, static imports are versioned using importmap
 * to prevent hash cascading (https://bundlers.tooling.report/hashing/avoid-cascade/)
 * 2. When importmap are not supported, systemjs is used to prevent hash cascading by default
 *   2.1 When a params is enabled it's possible to prefer hash cascading over systemjs
 *
 * Ideally we should do the following:
 * 1. start a chrome
 * 2. load the page
 * 3. change the export in a js file
 * 4. rebuild
 * 5. reload the page
 * 6. ensure only the modified js is fetched by the browser
 */

import { writeFileSync, readFileSync } from "node:fs"
import { chromium } from "playwright"
import { assert } from "@jsenv/assert"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginMinification } from "@jsenv/plugin-minification"

import { build } from "@jsenv/core"
import {
  readSnapshotsFromDirectory,
  writeSnapshotsIntoDirectory,
} from "@jsenv/core/tests/snapshots_directory.js"
import { startFileServer } from "@jsenv/core/tests/start_file_server.js"
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js"

const test = async ({ snapshotsDirectoryUrl, ...rest }) => {
  const generateDist = async () => {
    return await build({
      logLevel: "warn",
      rootDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./dist/", import.meta.url),
      entryPoints: {
        "./main.html": "main.html",
      },
      versioningMethod: "filename",
      plugins: [
        // we could just disable bundling to achieve the same result
        // but this allows to test versioning with bundling and include param
        jsenvPluginBundling({
          js_module: {
            include: {
              "**/*": true,
              "./file.js": false,
            },
          },
        }),
        jsenvPluginMinification(),
      ],
      writeGeneratedFiles: true,
      ...rest,
    })
  }

  // 1. Generate a first build
  const initialBuild = await generateDist()

  // 2. Ensure file executes properly
  const serverRequests = []
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
    canUseLongTermCache: (request) => !request.url.endsWith(".html"),
    services: [
      {
        name: "spy_request",
        handleRequest: (request) => {
          serverRequests.push(request)
        },
      },
    ],
  })
  const browser = await chromium.launch({ headless: true })
  const page = await launchBrowserPage(browser)
  await page.goto(`${server.origin}/main.html`)
  const initialReturnValue = await page.evaluate(
    /* eslint-disable no-undef */
    () => window.resultPromise,
    /* eslint-enable no-undef */
  )

  // Now update source file then rebuild testing that:
  // - snapshots are correct
  // - browser do not request the file
  const jsFileUrl = new URL("./client/file.js", import.meta.url)
  const jsFileContent = {
    beforeTest: readFileSync(jsFileUrl),
    update: (content) => writeFileSync(jsFileUrl, content),
    restore: () => writeFileSync(jsFileUrl, jsFileContent.beforeTest),
  }

  // rebuild
  try {
    jsFileContent.update(`export const answer = 43`)
    const modifiedBuild = await generateDist()

    // reload then ensure the browser did not re-fetch app.js
    serverRequests.length = 0
    await page.reload()
    const responseForAppJs = serverRequests.find((request) =>
      request.url.includes("app"),
    )
    const modifiedReturnValue = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    )

    const snapshotsInitialUrl = new URL("./initial/", snapshotsDirectoryUrl)
    const snapshotsInitialContent =
      readSnapshotsFromDirectory(snapshotsInitialUrl)
    const snapshotsModifiedUrl = new URL("./modified/", snapshotsDirectoryUrl)
    const snapshotsModifiedContent =
      readSnapshotsFromDirectory(snapshotsModifiedUrl)
    writeSnapshotsIntoDirectory(
      snapshotsInitialUrl,
      initialBuild.buildFileContents,
    )
    writeSnapshotsIntoDirectory(
      snapshotsModifiedUrl,
      modifiedBuild.buildFileContents,
    )
    assert({
      actual: {
        initial: initialBuild.buildFileContents,
        initialReturnValue,
        modified: modifiedBuild.buildFileContents,
        modifiedReturnValue,
        responseForAppJs,
      },
      expected: {
        initial: snapshotsInitialContent,
        initialReturnValue: 42,
        modified: snapshotsModifiedContent,
        modifiedReturnValue: 43,
        responseForAppJs: undefined,
      },
    })
  } finally {
    jsFileContent.restore()
    browser.close()
  }
}

// importmap are not supported
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/systemjs/", import.meta.url),
  runtimeCompat: { chrome: "88" },
})

// importmap supported
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/importmap/", import.meta.url),
  runtimeCompat: { chrome: "89" },
})
