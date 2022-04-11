import { existsSync } from "node:fs"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { parseCssUrls } from "@jsenv/core/src/internal/transform_css/parse_css_urls.js"
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
  entryPoints: {
    [`./${testDirectoryRelativeUrl}main.css`]: "main_build.css",
  },
  cssConcatenation: true,
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

const cssBuildUrl = resolveUrl("main_build.css", buildDirectoryUrl)
const cssString = await readFile(cssBuildUrl)

const cssUrls = await parseCssUrls({ url: cssBuildUrl, content: cssString })
const imgSpecifier = cssUrls[0].specifier
const filterSpecifier = cssUrls[1].specifier
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
