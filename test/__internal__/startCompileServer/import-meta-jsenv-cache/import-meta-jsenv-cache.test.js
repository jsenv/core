import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/server"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  readFile,
  bufferToEtag,
  readFileSystemNodeModificationTime,
} from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_BUILD_COMMONJS } from "@jsenv/core/src/internal/CONSTANTS.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}file.cjs`
const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)

;["etag", "mtime"].reduce(async (previous, compileCacheStrategy) => {
  await previous

  const compileServer = await startCompileServer({
    compileServerLogLevel: "warn",
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    compileCacheStrategy,
    jsenvDirectoryClean: true,
    env: {
      whatever: 42,
    },
  })

  const buildDirectoryRelativeUrl = `${compileServer.outDirectoryRelativeUrl}${COMPILE_ID_BUILD_COMMONJS}/`
  const fileBuildServerUrl = `${compileServer.origin}/${buildDirectoryRelativeUrl}${fileRelativeUrl}`
  const fileBuildUrl = `${projectDirectoryUrl}${buildDirectoryRelativeUrl}${fileRelativeUrl}`

  const response = await fetchUrl(fileBuildServerUrl)
  if (compileCacheStrategy === "etag") {
    const actual = {
      status: response.status,
      etag: response.headers.get("etag"),
    }
    const expected = {
      status: 200,
      etag: bufferToEtag(await readFile(fileBuildUrl, { as: "buffer" })),
    }
    assert({ actual, expected })

    // ensure etag cache works
    {
      const secondResponse = await fetchUrl(fileBuildServerUrl, {
        headers: {
          "if-none-match": response.headers.get("etag"),
        },
      })
      const actual = secondResponse.status
      const expected = 304
      assert({ actual, expected })
    }
  }
  if (compileCacheStrategy === "mtime") {
    const actual = {
      status: response.status,
      lastModified: response.headers.get("last-modified"),
    }
    const expected = {
      status: 200,
      lastModified: new Date(
        await readFileSystemNodeModificationTime(fileBuildUrl),
      ).toUTCString(),
    }
    assert({ actual, expected })

    // ensure mtime cache works
    {
      const secondResponse = await fetchUrl(fileBuildServerUrl, {
        headers: {
          "if-modified-since": response.headers.get("last-modified"),
        },
      })
      const actual = secondResponse.status
      const expected = 304
      assert({ actual, expected })
    }
  }

  const sourcemapFileUrl = `${fileBuildUrl}.map`
  {
    const actual = await readFile(sourcemapFileUrl, { as: "json" })
    const expected = {
      version: 3,
      file: "file.cjs",
      sources: ["../../../../../../../file.cjs"],
      sourcesContent: null,
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }

  const fileBuildMetaUrl = `${fileBuildUrl}__asset__meta.json`
  {
    const actual = await readFile(fileBuildMetaUrl, { as: "json" })
    const expected = {
      contentType: "application/javascript",
      sources: ["../../../../../../../file.cjs"],
      sourcesEtag: [bufferToEtag(readFileSync(urlToFileSystemPath(fileUrl)))],
      assets: ["file.cjs.map"],
      assetsEtag: [
        bufferToEtag(readFileSync(urlToFileSystemPath(sourcemapFileUrl))),
      ],
      createdMs: actual.createdMs,
      lastModifiedMs: actual.lastModifiedMs,
    }
    assert({ actual, expected })
  }
  {
    // eslint-disable-next-line import/no-dynamic-require
    const namespace = require(urlToFileSystemPath(fileBuildUrl))
    const actual = typeof namespace.groupMap
    const expected = "undefined"
    assert({ actual, expected })
  }
}, Promise.resolve())
