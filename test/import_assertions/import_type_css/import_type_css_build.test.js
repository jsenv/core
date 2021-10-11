import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const mainFilename = `main.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.prod.html",
}
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const build = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap,
    ...params,
  })
  return build
}

{
  const { buildMappings } = await test({ jsConcatenation: true })
  const jsFileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${jsFileBuildRelativeUrl}`,
  })
  const jsFileBuildUrl = resolveUrl(jsFileBuildRelativeUrl, buildDirectoryUrl)
  const jsFileContent = await readFile(jsFileBuildUrl)
  const jsFileContainsImgBuildRelativeUrl = jsFileContent.includes(
    buildMappings[`${testDirectoryRelativeUrl}src/jsenv.png`],
  )

  const actual = {
    jsFileContainsImgBuildRelativeUrl,
    buildMappings,
    namespace,
  }
  const expected = {
    jsFileContainsImgBuildRelativeUrl: true,
    buildMappings: {
      [`${testDirectoryRelativeUrl}src/jsenv.png`]: assert.any(String),
      [`${testDirectoryRelativeUrl}main.html`]: assert.any(String),
      [`${testDirectoryRelativeUrl}main.js`]: assert.any(String),
    },
    namespace: {
      backgroundBodyColor: "rgb(255, 0, 0)",
    },
  }
  assert({ actual, expected })
}

// no concatenation + runtime support enough
{
  const { buildMappings } = await test({
    jsConcatenation: false,
    runtimeSupport: { chrome: "96" },
  })
  const jsFileBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}main.js`]
  const { namespace } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    jsFileRelativeUrl: `./${jsFileBuildRelativeUrl}`,
  })
  const jsFileBuildUrl = resolveUrl(jsFileBuildRelativeUrl, buildDirectoryUrl)
  const jsFileContent = await readFile(jsFileBuildUrl)
  const jsFileContainsImgBuildRelativeUrl = jsFileContent.includes(
    buildMappings[`${testDirectoryRelativeUrl}src/jsenv.png`],
  )

  const actual = {
    jsFileContainsImgBuildRelativeUrl,
    buildMappings,
    namespace,
  }
  const expected = {
    jsFileContainsImgBuildRelativeUrl: true,
    buildMappings: {
      [`${testDirectoryRelativeUrl}src/jsenv.png`]: assert.any(String),
      [`${testDirectoryRelativeUrl}main.html`]: assert.any(String),
      [`${testDirectoryRelativeUrl}main.js`]: assert.any(String),
    },
    namespace: {
      backgroundBodyColor: "rgb(255, 0, 0)",
    },
  }
  assert({ actual, expected })
}
