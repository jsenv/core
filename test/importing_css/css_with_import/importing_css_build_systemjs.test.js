import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToFileSystemPath,
  urlToRelativeUrl,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`

try {
  await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    useImportMapToMaximizeCacheReuse: false,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${testDirectoryRelativeUrl}main.js`]: "main.js",
    },
    // logLevel: "debug",
    // minify: true,
  })
  throw new Error("should throw")
} catch (e) {
  const cssFileUrl = resolveUrl("./style.css", testDirectoryUrl)
  const jsFileUrl = resolveUrl("./main.js", testDirectoryUrl)

  const actual = e.message
  const expected = `invalid "content-type" on url
--- content-type ---
"text/css"
--- expected content-type ---
"application/javascript"
--- url ---
${cssFileUrl}
--- url trace ---
${urlToFileSystemPath(jsFileUrl)}
  imported by ${urlToFileSystemPath(jsenvCoreDirectoryUrl)}
--- suggestion ---
use import.meta.url: new URL("./style.css", import.meta.url)
--- suggestion 2 ---
use import assertion: import css from "./style.css" assert { type: "css" }`
  assert({ actual, expected })
}
