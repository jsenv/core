import { assert } from "@jsenv/assert"
import {
  resolveUrl,
  urlToRelativeUrl,
  readFile,
  bufferToEtag,
  readFileSystemNodeModificationTime,
} from "@jsenv/filesystem"
import { fetchUrl } from "@jsenv/server"

import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const filename = `file.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}out/${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${compiledFileRelativeUrl}`

// just the file itself
{
  const { origin: compileServerOrigin } = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    compileCacheStrategy: "etag",
    runtimeSupport: jsenvRuntimeSupportDuringDev,
  })
  const fileServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
  const { status, statusText, headers } = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
  })

  const actual = {
    status,
    statusText,
    contentType: headers.get("content-type"),
  }
  const expected = {
    status: 200,
    statusText: "OK",
    contentType: "application/javascript",
  }
  assert({ actual, expected })
}

// etag caching
{
  const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
    await startCompileServer({
      ...COMPILE_SERVER_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      compileCacheStrategy: "etag",
    })
  const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
  const firstResponse = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
  })
  {
    const actual = {
      status: firstResponse.status,
      etag: firstResponse.headers.get("etag"),
    }
    const expected = {
      status: 200,
      etag: bufferToEtag(await readFile(compiledFileUrl, { as: "buffer" })),
    }
    assert({ actual, expected })
  }
  const secondResponse = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
    headers: {
      "if-none-match": firstResponse.headers.get("etag"),
    },
  })
  {
    const actual = {
      status: secondResponse.status,
      statusText: secondResponse.statusText,
    }
    const expected = {
      status: 304,
      statusText: "Not Modified",
    }
    assert({ actual, expected })
  }
}

// mtime caching
{
  const { origin: compileServerOrigin, outDirectoryRelativeUrl } =
    await startCompileServer({
      ...COMPILE_SERVER_TEST_PARAMS,
      jsenvDirectoryRelativeUrl,
      compileCacheStrategy: "mtime",
    })
  const fileServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
  const firstResponse = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
  })
  {
    const actual = {
      status: firstResponse.status,
      lastModified: firstResponse.headers.get("last-modified"),
    }
    const expected = {
      status: 200,
      lastModified: new Date(
        await readFileSystemNodeModificationTime(compiledFileUrl),
      ).toUTCString(),
    }
    assert({ actual, expected })
  }
  const secondResponse = await fetchUrl(fileServerUrl, {
    ignoreHttpsError: true,
    headers: {
      "if-modified-since": firstResponse.headers.get("last-modified"),
    },
  })
  {
    const actual = {
      status: secondResponse.status,
      statusText: secondResponse.statusText,
    }
    const expected = {
      status: 304,
      statusText: "Not Modified",
    }
    assert({ actual, expected })
  }
}
