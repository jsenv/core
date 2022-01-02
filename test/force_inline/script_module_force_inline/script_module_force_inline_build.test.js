import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import {
  findNodeByTagName,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${mainFilename}`
const { buildManifest, buildFileContents, buildInlineFileContents } =
  await buildProject({
    ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
    // logLevel: "debug",
    jsenvDirectoryRelativeUrl,
    buildDirectoryRelativeUrl,
    entryPointMap: {
      [`./${fileRelativeUrl}`]: "main.html",
    },
  })

// ensuire buildManifest, fileContents and inlineFileContents looks good
{
  const actual = {
    buildManifest,
    buildFileContents,
    buildInlineFileContents,
  }
  const expected = {
    buildManifest: {
      "main.html": "main.html",
    },
    buildFileContents: {
      "file-02c226c4.js.map": assert.any(String),
      "main.html": assert.any(String),
    },
    buildInlineFileContents: {
      "file-02c226c4.js": assert.any(String),
    },
  }
  assert({ actual, expected })
}

const buildDirectoryUrl = resolveUrl(
  buildDirectoryRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)

// ensure link preload is removed (because ressource is inlined)
{
  const link = findNodeByTagName(htmlString, "link")
  const actual = link
  const expected = null
  assert({ actual, expected })
}

// ensure src is properly inlined
{
  const script = findNodeByTagName(htmlString, "script")
  const srcAttribute = getHtmlNodeAttributeByName(script, "src")
  const forceInlineAttribute = getHtmlNodeAttributeByName(
    script,
    "data-jsenv-force-inline",
  )
  const textNode = getHtmlNodeTextNode(script)

  const actual = {
    srcAttribute,
    forceInlineAttribute,
    textNodeValue: textNode.value,
  }
  const expected = {
    srcAttribute: undefined,
    forceInlineAttribute: undefined,
    textNodeValue: `// eslint-disable-next-line import/no-unresolved

{
  var answer = 42;
  console.log(answer);
}

//# sourceMappingURL=file-02c226c4.js.map`,
  }
  assert({ actual, expected })
}
