import { assert } from "@jsenv/assert"
import { urlToRelativeUrl, resolveUrl } from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "@jsenv/core/test/__internal__/startCompileServer/TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

const server = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  customCompilers: {
    [`./${testDirectoryRelativeUrl}file.js`]: async () => {
      const build = await buildProject({
        logLevel: "warn",
        projectDirectoryUrl: jsenvCoreDirectoryUrl,
        buildDirectoryRelativeUrl: `./${testDirectoryRelativeUrl}dist/`,
        format: "global",
        entryPointMap: {
          [`./${testDirectoryRelativeUrl}file.js`]: `./${testDirectoryRelativeUrl}file.js`,
        },
      })

      const sources = []
      const sourcesContent = []
      const assets = []
      const assetsContent = []

      const buildDirectoryUrl = resolveUrl(
        `./${testDirectoryRelativeUrl}dist/`,
        jsenvCoreDirectoryUrl,
      )
      Object.keys(build.buildFileContents).forEach((buildFileRelativeUrl) => {
        const buildFileContent = build.buildFileContents[buildFileRelativeUrl]
        if (buildFileRelativeUrl.endsWith(".map")) {
          assets.push(resolveUrl(buildFileRelativeUrl, buildDirectoryUrl))
          assetsContent.push(buildFileContent)
        } else {
          sources.push(resolveUrl(buildFileRelativeUrl, buildDirectoryUrl))
          sourcesContent.push(buildFileContent)
        }
      })
      const mainBuildRelativeUrl =
        build.buildMappings[`${testDirectoryRelativeUrl}file.js`]
      const mainBuildFileContent = build.buildFileContents[mainBuildRelativeUrl]

      return {
        contentType: "application/javascript",
        compiledSource: mainBuildFileContent,
        sources,
        sourcesContent,
        assets,
        assetsContent,
        isBuild: true,
      }
    },
  },
})

const fileServerUrl = `${server.origin}/${server.outDirectoryRelativeUrl}best/${testDirectoryRelativeUrl}file.js`

// first fetch
const firstResponse = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
})
{
  const actual = {
    status: firstResponse.status,
  }
  const expected = {
    status: 200,
  }
  assert({ actual, expected })
}

// second call (forward etag header)
const secondResponse = await fetchUrl(fileServerUrl, {
  ignoreHttpsError: true,
  headers: {
    "if-none-match": firstResponse.headers.get("etag"),
    "if-modified-since": firstResponse.headers.get("last-modified"),
  },
})
{
  const actual = {
    status: secondResponse.status,
  }
  const expected = {
    status: 304,
  }
  assert({ actual, expected })
}
