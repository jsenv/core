import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const testBuild = async (params) => {
  const { buildMappings } = await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.prod.html",
    },
    ...params,
  })
  return { buildMappings }
}

const testExecution = async () => {
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    htmlFileRelativeUrl: "./dist/esmodule/main.prod.html",
    codeToRunInBrowser: `window.namespace`,
  })
  return { namespace, serverOrigin }
}

// default (no runtime support + concatenation)
{
  const { buildMappings } = await testBuild()
  const { namespace, serverOrigin } = await testExecution()
  const imgBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}src/jsenv.png`]

  const actual = namespace
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/dist/esmodule/${imgBuildRelativeUrl}")`,
  }
  assert({ actual, expected })
}

// runtime support
{
  const { buildMappings } = await testBuild({
    runtimeSupport: { chrome: "96" },
  })
  const { namespace, serverOrigin } = await testExecution()
  const imgBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}src/jsenv.png`]

  const actual = namespace
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/dist/esmodule/${imgBuildRelativeUrl}")`,
  }
  assert({ actual, expected })
}

// no concatenation + runtime support
{
  const { buildMappings } = await testBuild({
    jsConcatenation: false,
    runtimeSupport: { chrome: "96" },
  })
  const { namespace, serverOrigin } = await testExecution()
  const imgBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}src/jsenv.png`]

  const actual = namespace
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${serverOrigin}/dist/esmodule/${imgBuildRelativeUrl}")`,
  }
  assert({ actual, expected })
}
