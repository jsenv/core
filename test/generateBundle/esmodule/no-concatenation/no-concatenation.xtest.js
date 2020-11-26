// test disabled until https://github.com/rollup/rollup/issues/3882

import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { generateBundle } from "@jsenv/core/index.js"
import {
  GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  BROWSER_IMPORT_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"
import { browserImportBundle } from "../browserImportBundle.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const bundleDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.js`

const { bundleMappings } = await generateBundle({
  ...GENERATE_ESMODULE_BUNDLE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.js",
  },
  jsConcatenation: false,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

const indexRelativeUrl = getBundleRelativeUrl("index.js")

{
  const { value: actual } = await browserImportBundle({
    ...BROWSER_IMPORT_BUNDLE_TEST_PARAMS,
    bundleDirectoryRelativeUrl,
    mainRelativeUrl: `./${indexRelativeUrl}`,
    headless: false,
    stopAfterImport: false,
  })
  const expected = 42
  assert({ actual, expected })
}
