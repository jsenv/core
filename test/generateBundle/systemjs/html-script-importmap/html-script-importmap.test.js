/**

Let's ensure how importmap ends up in dist

*/

import { basename } from "path"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"
import { generateSystemJsBundle } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  main: `./${testDirectoryRelativeUrl}${mainFilename}`,
}

await generateSystemJsBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap,
})

// const { namespace: actual } = await browserImportSystemJsBundle({
//   ...IMPORT_SYSTEM_JS_BUNDLE_TEST_PARAMS,
//   testDirectoryRelativeUrl,
// })
// const expected = {
//   htmlText: `<button>Hello world</button>`,
//   innerText: "Hello world",
// }
// assert({ actual, expected })
