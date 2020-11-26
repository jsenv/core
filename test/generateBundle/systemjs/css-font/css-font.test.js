import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/bundling/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `style.css`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./style.css",
}

const { bundleMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUNDLE_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
})

const getBundleRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const bundleRelativeUrl = bundleMappings[relativeUrl]
  return bundleRelativeUrl
}

const bundleDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const cssBundleRelativeUrl = getBundleRelativeUrl("style.css")
const cssBundleUrl = resolveUrl(cssBundleRelativeUrl, bundleDirectoryUrl)
const cssString = await readFile(cssBundleUrl)

// ensure font urls properly updated in css file
{
  const cssUrls = await parseCssUrls(cssString, cssBundleUrl)
  const fontSpecifier = cssUrls.urlDeclarations[0].specifier
  const fontBundleRelativeUrl = getBundleRelativeUrl("Roboto-Thin.ttf")
  const fontBundleUrl = resolveUrl(fontBundleRelativeUrl, bundleDirectoryUrl)

  const actual = fontSpecifier
  const expected = urlToRelativeUrl(fontBundleUrl, cssBundleUrl)
  assert({ actual, expected })

  await assertFilePresence(fontBundleUrl)
}
