/*
 * to update the index.es5.js.map
 * you can use getSourceMap from @jsenv/core/test/get_source_map.js
 */

import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToFilename,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `script_with_sourcemap.html`
const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const test = async (params) => {
  const { buildMappings } = await buildProject({
    ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
    // logLevel: "info",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPoints: {
      [`./${testDirectoryRelativeUrl}${mainFilename}`]: "main.html",
    },
    ...params,
  })
  const scriptBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}index.es5.js`]
  const sourcemapBuildRelativeUrl =
    buildMappings[`${testDirectoryRelativeUrl}index.es5.js.map`]

  return {
    scriptBuildRelativeUrl,
    sourcemapBuildRelativeUrl,
  }
}

// without minification
{
  const { scriptBuildRelativeUrl, sourcemapBuildRelativeUrl } = await test()
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)
  const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
  const htmlString = await readFile(htmlBuildUrl)
  const scriptNode = findNodeByTagName(htmlString, "script")

  // script.src is correct
  {
    const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
    const actual = srcAttribute.value
    const expected = scriptBuildRelativeUrl
    assert({ actual, expected })
  }

  // sourcemap file is copied too
  {
    const scriptString = await readFile(scriptBuildUrl)
    const actual = getJavaScriptSourceMappingUrl(scriptString)
    const expected = urlToRelativeUrl(sourcemapBuildUrl, scriptBuildUrl)
    assert({ actual, expected })
  }

  // souremap file content
  {
    const sourcemapString = await readFile(sourcemapBuildUrl)
    const sourcemap = JSON.parse(sourcemapString)
    const actual = {
      file: sourcemap.file,
      sources: sourcemap.sources,
    }
    const expected = {
      file: urlToFilename(scriptBuildUrl),
      sources: ["../../../index.source.js"],
    }
    assert({ actual, expected })
  }

  // execution works
  {
    const { returnValue } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: "./dist/systemjs/main.html",
      /* eslint-disable no-undef */
      pageFunction: () => {
        return window.whatever
      },
      /* eslint-enable no-undef */
    })
    const actual = returnValue
    const expected = 42
    assert({ actual, expected })
  }
}

// with minification
{
  const { scriptBuildRelativeUrl, sourcemapBuildRelativeUrl } = await test({
    minify: true,
  })
  const sourcemapBuildUrl = resolveUrl(
    sourcemapBuildRelativeUrl,
    buildDirectoryUrl,
  )
  const scriptBuildUrl = resolveUrl(scriptBuildRelativeUrl, buildDirectoryUrl)

  // souremap file content
  {
    const sourcemapString = await readFile(sourcemapBuildUrl)
    const sourcemap = JSON.parse(sourcemapString)
    const actual = {
      file: sourcemap.file,
      sources: sourcemap.sources,
    }
    const expected = {
      file: urlToFilename(scriptBuildUrl),
      sources: ["../../../index.source.js"],
    }
    assert({ actual, expected })
  }
}
