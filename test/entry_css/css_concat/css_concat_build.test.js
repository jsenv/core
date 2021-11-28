import { assert } from "@jsenv/assert"
import { existsSync } from "fs"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/`
const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}main.css`]: "./main_build.css",
  },
  cssConcatenation: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

const cssBuildUrl = resolveUrl("main_build.css", buildDirectoryUrl)
const cssString = await readFile(cssBuildUrl)

const cssUrls = await parseCssUrls({ code: cssString, url: cssBuildUrl })
const imgSpecifier = cssUrls.urlDeclarations[0].specifier
const filterSpecifier = cssUrls.urlDeclarations[1].specifier
const imgBuildRelativeUrl =
  buildMappings[`${testDirectoryRelativeUrl}jsenv.png`]
const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)

const actual = {
  imgSpecifier,
  filterSpecifier,
  imgFileExists: existsSync(urlToFileSystemPath(imgBuildUrl)),
}
const expected = {
  imgSpecifier: urlToRelativeUrl(imgBuildUrl, cssBuildUrl),
  filterSpecifier: "#better-blur",
  imgFileExists: true,
}
assert({ actual, expected })
