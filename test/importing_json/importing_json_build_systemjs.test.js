import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
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
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}main.html`]: "./main.html",
}
const jsonFileUrl = resolveUrl("./file.json", import.meta.url)
const jsFileUrl = resolveUrl("./main.js", import.meta.url)
const htmlFileUrl = resolveUrl("./main.html", import.meta.url)

try {
  await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    minify: true,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `invalid "content-type" on url
--- content-type ---
"application/json"
--- expected content-type ---
"application/javascript"
--- url ---
${jsonFileUrl}
--- url trace ---
${urlToFileSystemPath(jsFileUrl)}
  imported by ${urlToFileSystemPath(htmlFileUrl)}
--- suggestion ---
use import.meta.url: new URL("./file.json", import.meta.url)
--- suggestion 2 ---
use import assertion: import data from "./file.json" assert { type: "json" }`
  assert({ actual, expected })
}
