import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { browserImportSystemJsBuild } from "@jsenv/core/test/browserImportSystemJsBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `importing_preact.html`
const { projectBuildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  // filesystemCache: true,
  buildDirectoryRelativeUrl,
  entryPoints: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
  },
})
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const mainJsBuildRelativeUrl =
  projectBuildMappings[`${testDirectoryRelativeUrl}importing_preact.js`]
const sourcemapBuildRelativeUrl = `${mainJsBuildRelativeUrl}.map`

// sourcemap
{
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const buildRelativeParts = urlToRelativeUrl(
    jsenvCoreDirectoryUrl,
    buildDirectoryUrl,
  )
  const sourcemapString = await readFile(sourcemapBuildUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const actual = {
    file: sourcemap.file,
    sources: sourcemap.sources,
  }
  const expected = {
    file: "importing_preact.js",
    sources: [
      `${buildRelativeParts}helpers/babel/typeof/typeof.js`,
      `${buildRelativeParts}node_modules/preact/src/util.js`,
      `${buildRelativeParts}node_modules/preact/src/options.js`,
      `${buildRelativeParts}node_modules/preact/src/create-element.js`,
      `${buildRelativeParts}node_modules/preact/src/constants.js`,
      `${buildRelativeParts}node_modules/preact/src/diff/catch-error.js`,
      `${buildRelativeParts}node_modules/preact/src/component.js`,
      "../../importing_preact.js",
    ],
  }
  assert({ actual, expected })
}

{
  const { namespace } = await browserImportSystemJsBuild({
    ...IMPORT_SYSTEM_JS_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./${mainJsBuildRelativeUrl}`,
    // headless: false,
    // autoStop: false,
  })

  const actual = namespace
  const expected = {
    default: "function",
  }
  assert({ actual, expected })
}
