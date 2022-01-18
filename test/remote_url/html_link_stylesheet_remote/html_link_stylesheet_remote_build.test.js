import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
} from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { executeInBrowser } from "@jsenv/core/test/execute_in_browser.js"

import {
  findHtmlNodeById,
  getHtmlNodeAttributeByName,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const { server } = await import("./server/serve.js")
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
  const readLinkHrefAndFontFamily = async () => {
    const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
    const htmlString = await readFile(htmlBuildUrl)
    const linkNode = findHtmlNodeById(htmlString, "roboto_link")
    const hrefAttribute = getHtmlNodeAttributeByName(linkNode, "href")
    const href = hrefAttribute ? hrefAttribute.value : ""
    const { returnValue } = await executeInBrowser({
      directoryUrl: new URL("./", import.meta.url),
      htmlFileRelativeUrl: "./dist/esmodule/main.html",
      /* eslint-disable no-undef */
      pageFunction: async () => {
        await document.fonts.ready
        const fontFamily = window.getComputedStyle(
          document.querySelector("body"),
        ).fontFamily
        return fontFamily
      },
      /* eslint-enable no-undef */
    })
    return { href, fontFamily: returnValue }
  }

  // remote css fetched during build
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
    const { href, fontFamily } = await readLinkHrefAndFontFamily()

    const actual = {
      href,
      fontFamily,
    }
    const expected = {
      href: "assets/roboto_2f520b36.css",
      fontFamily: "Roboto",
    }
    assert({ actual, expected })
  }

  // remote css preserved
  {
    await buildProject({
      ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
      // logLevel: "debug",
      jsenvDirectoryRelativeUrl,
      entryPoints,
      buildDirectoryRelativeUrl,
      format: "esmodule",
    })
    const { href, fontFamily } = await readLinkHrefAndFontFamily()

    const actual = {
      href,
      fontFamily,
    }
    const expected = {
      href: `${server.origin}/roboto.css`,
      fontFamily: "Roboto",
    }
    assert({ actual, expected })
  }
} finally {
  server.stop()
}
