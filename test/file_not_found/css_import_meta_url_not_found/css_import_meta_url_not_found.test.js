import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

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
const cssFileUrl = resolveUrl("./style.css", import.meta.url)
const jsFileUrl = resolveUrl("./main.js", import.meta.url)
const htmlFileUrl = resolveUrl(`./main.html`, import.meta.url)

try {
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
  })
  throw new Error("should throw")
} catch (e) {
  const actual = e.message
  const expected = `404 on url
--- url ---
${cssFileUrl}
--- url trace ---
${urlToFileSystemPath(jsFileUrl)}:1:13
> 1 | var cssUrl = new URL("./style.css", import.meta.url);
                  ^
  2 | console.log(cssUrl);
  referenced by ${urlToFileSystemPath(htmlFileUrl)}:10:27`
  assert({ actual, expected })
}
