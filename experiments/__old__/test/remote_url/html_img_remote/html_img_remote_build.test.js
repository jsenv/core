import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/transform_html/html_ast.js"

const { server } = await import("./scripts/serve.js")
try {
  const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
  const testDirectoryRelativeUrl = urlToRelativeUrl(
    testDirectoryUrl,
    jsenvCoreDirectoryUrl,
  )
  const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
  const entryPoints = {
    [`./${testDirectoryRelativeUrl}main.html`]: "main.html",
  }
  const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  const readImgSrc = async () => {
    const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
    const htmlString = await readFile(htmlBuildUrl)
    const scriptNode = findHtmlNodeById(htmlString, "img")
    const srcAttribute = getHtmlNodeAttributeByName(scriptNode, "src")
    const src = srcAttribute ? srcAttribute.value : ""
    return { src }
  }

  // remote img fetched during build
  {
    await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
      preservedUrls: {
        "http://localhost:9999/": false,
      },
    })
    const { src } = await readImgSrc()

    const actual = {
      src,
    }
    const expected = {
      src: "assets/jsenv_25e95a00.png",
    }
    assert({ actual, expected })
  }

  // remote img preserved
  {
    await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
    })
    const { src } = await readImgSrc()

    const actual = {
      src,
    }
    const expected = {
      src: `${server.origin}/jsenv.png`,
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
