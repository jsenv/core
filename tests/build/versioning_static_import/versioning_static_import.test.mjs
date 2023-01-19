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
      ],
      writeGeneratedFiles: true,
      ...rest,
    })
  }

  // 1. test snapshots
  {
    const { buildFileContents } = await generateDist()
    const snapshotsInitialUrl = new URL("./initial/", snapshotsDirectoryUrl)
    const snapshotsInitialContent =
      readSnapshotsFromDirectory(snapshotsInitialUrl)
    writeSnapshotsIntoDirectory(snapshotsInitialUrl, buildFileContents)
    assert({
      actual: buildFileContents,
      expected: snapshotsInitialContent,
    })
  }

  // 2. Ensure file executes properly
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  })
  const browser = await chromium.launch({ headless: true })
  const page = await launchBrowserPage(browser)
  const responses = []
  page.on("response", (response) => {
    responses.push(response)
  })
  await page.goto(`${server.origin}/main.html`)
  {
    const returnValue = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.resultPromise,
      /* eslint-enable no-undef */
    )
    assert({
      actual: returnValue,
      expected: 42,
    })
  }

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
  jsFileContent.update(`export const answer = 43`)
  const { buildFileContents } = await generateDist()

  // test snapshots
  {
    const snapshotsModifiedUrl = new URL("./modified/", snapshotsDirectoryUrl)
    const snapshotsModifiedContent = readSnapshotsFromDirectory(
      snapshotsDirectoryUrl,
    )
    writeSnapshotsIntoDirectory(snapshotsModifiedUrl, buildFileContents)
    assert({
      actual: buildFileContents,
      expected: snapshotsModifiedContent,
    })
  }

  // reload
  responses.length = 0
  await page.reload()
}

// importmap are not supported
// await test({
//   snapshotsDirectoryUrl: new URL("./snapshots/systemjs /", import.meta.url),
//   runtimeCompat: { chrome: "88" },
// })

// importmap supported
await test({
  snapshotsDirectoryUrl: new URL("./snapshots/importmap/", import.meta.url),
  runtimeCompat: { chrome: "89" },
})
