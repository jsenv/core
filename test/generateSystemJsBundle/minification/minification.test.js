import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { generateBundle } from "../../../index.js"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.js`

const { rollupBundle } = await generateBundle({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
  minify: true,
})
const actual = rollupBundle.output[0].code.trim()
const expected = `System.register([],(function(e){"use strict";return{execute:function(){e("default",42)}}}));`
assert({ actual, expected })
