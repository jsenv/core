// TODO

import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const entryPoints = {
  [`./${testDirectoryRelativeUrl}style.css`]: "style.css",
}
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)

// remote url preserved by default
// {
//   const { buildMappings } = await buildProject({
//     ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
//     // logLevel: "debug",
//     jsenvDirectoryRelativeUrl,
//     buildDirectoryRelativeUrl,
//     entryPoints,
//   })
//   const cssBuildRelativeUrl =
//     buildMappings[`${testDirectoryRelativeUrl}style.css`]
//   const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
//   const cssString = await readFile(cssBuildUrl)
//   const cssUrls = await parseCssUrls({ code: cssString, url: cssBuildUrl })
//   const fontSpecifier = cssUrls.atImports[0].specifier

//   const actual = {
//     fontSpecifier,
//   }
//   const expected = {
//     fontSpecifier: "http://localhost:9999/roboto.css",
//   }
//   assert({ actual, expected })
// }

// remote url ends up in the build directory
{
  const { server } = await import("./script/serve.js")
  try {
    const { buildMappings } = await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      buildDirectoryRelativeUrl,
      entryPoints,
      preservedUrls: {
        [`${server.origin}/`]: false,
      },
    })
    const cssBuildRelativeUrl =
      buildMappings[`${testDirectoryRelativeUrl}style.css`]
    const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
    const cssString = await readFile(cssBuildUrl)
    const cssUrls = await parseCssUrls({ code: cssString, url: cssBuildUrl })
    const fontSpecifier = cssUrls.atImports[0].specifier

    const actual = {
      fontSpecifier,
    }
    const expected = {
      fontSpecifier: "assets/roboto_hash.css",
    }
    assert({ actual, expected })
  } finally {
    server.stop()
  }
}
