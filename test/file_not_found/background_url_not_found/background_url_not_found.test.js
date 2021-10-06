import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}main.html`]: "./main.html",
}
const imgUrl = resolveUrl("img.png", import.meta.url)
const cssFileUrl = resolveUrl("./style.css", import.meta.url)
const jsFileUrl = resolveUrl("./main.js", import.meta.url)
const htmlFileUrl = resolveUrl("./main.html", import.meta.url)

try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `404 on url
--- url ---
${imgUrl}
--- url trace ---
${urlToFileSystemPath(cssFileUrl)}:2:3
  1 | body {
> 2 |   background-image: url("./img.png");
        ^
  3 | }
  imported by ${urlToFileSystemPath(jsFileUrl)}:13:1
  referenced by ${urlToFileSystemPath(htmlFileUrl)}:10:27`
  assert({ actual, expected })
}
