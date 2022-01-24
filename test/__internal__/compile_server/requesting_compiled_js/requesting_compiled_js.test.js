import { fetchUrl } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  readFile,
  bufferToEtag,
  readFileSystemNodeModificationTime,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.js`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)

// etag caching
{
  const compileServer = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    compileCacheStrategy: "etag",
  })
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({
    env: { browser: true },
  })
  const fileCompiledRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
  const fileCompiledServerUrl = `${compileServer.origin}/${fileCompiledRelativeUrl}`
  const fileCompileUrl = `${jsenvCoreDirectoryUrl}${fileCompiledRelativeUrl}`
  const firstResponse = await fetchUrl(fileCompiledServerUrl, {
    ignoreHttpsError: true,
  })
  {
    const actual = {
      status: firstResponse.status,
      etag: firstResponse.headers.get("etag"),
    }
    const expected = {
      status: 200,
      etag: bufferToEtag(await readFile(fileCompileUrl, { as: "buffer" })),
    }
    assert({ actual, expected })
  }
  // let time to write the compiled files on filesystem
  await new Promise((resolve) => setTimeout(resolve, 500))

  const secondResponse = await fetchUrl(fileCompiledServerUrl, {
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
  const compileServer = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    compileCacheStrategy: "mtime",
  })
  const { compileId } = await compileServer.createCompileIdFromRuntimeReport({
    env: { browser: true },
  })
  const fileCompiledRelativeUrl = `${compileServer.jsenvDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`
  const fileCompiledServerUrl = `${compileServer.origin}/${fileCompiledRelativeUrl}`
  const fileCompileUrl = `${jsenvCoreDirectoryUrl}${fileCompiledRelativeUrl}`
  const firstResponse = await fetchUrl(fileCompiledServerUrl, {
    ignoreHttpsError: true,
  })

  // let time to write the compiled files on filesystem
  await new Promise((resolve) => setTimeout(resolve, 500))
  {
    const actual = {
      status: firstResponse.status,
      lastModified: firstResponse.headers.get("last-modified"),
    }
    const expected = {
      status: 200,
      lastModified: new Date(
        await readFileSystemNodeModificationTime(fileCompileUrl),
      ).toUTCString(),
    }
    assert({ actual, expected })
  }

  const secondResponse = await fetchUrl(fileCompiledServerUrl, {
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
