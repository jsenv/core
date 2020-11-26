/* eslint-disable import/max-dependencies */
import { readFileSync } from "fs"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import {
  resolveUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  readFile,
  bufferToEtag,
} from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { serveBuild } from "@jsenv/core/src/internal/compiling/serveBuild.js"
import { jsenvBabelPluginMap } from "@jsenv/core/src/jsenvBabelPluginMap.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const originalFileUrl = resolveUrl("./file.cjs", import.meta.url)
const compiledFileUrl = resolveUrl("./.jsenv/file.cjs", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const projectDirectoryUrl = jsenvCoreDirectoryUrl
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const babelPluginMap = jsenvBabelPluginMap

;["etag", "mtime"].reduce(async (previous, compileCacheStrategy) => {
  await previous

  const compileServer = await startCompileServer({
    compileServerLogLevel: "warn",
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean: true,
    babelPluginMap,
    env: {
      whatever: 42,
    },
  })
  const ressource = `/${compileServer.outDirectoryRelativeUrl}file.cjs`
  const serveBuildParams = {
    cancellationToken: createCancellationToken(),
    logger: createLogger({ logLevel: "warn" }),

    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
    outDirectoryRelativeUrl: compileServer.outDirectoryRelativeUrl,
    originalFileUrl,
    compiledFileUrl,
    compileServerOrigin: compileServer.origin,
    compileCacheStrategy,

    format: "commonjs",
    projectFileRequestedCallback: () => {},
    request: {
      origin: compileServer.origin,
      ressource,
      method: "GET",
      headers: {},
    },
    babelPluginMap,
  }

  const response = await serveBuild(serveBuildParams)
  {
    const { status: actual } = response
    const expected = 200
    assert({ actual, expected })
  }
  {
    const sourcemapFileUrl = `${compiledFileUrl}.map`
    const actual = JSON.parse(await readFile(sourcemapFileUrl))
    const expected = {
      version: 3,
      file: "file.cjs",
      sources: ["out/groupMap.json", "../file.cjs"],
      sourcesContent: null,
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
  {
    const metaFileUrl = `${compiledFileUrl}__asset__meta.json`
    const actual = JSON.parse(await readFile(metaFileUrl))
    const expected = {
      contentType: "application/javascript",
      sources: ["out/groupMap.json", "../file.cjs"],
      sourcesEtag: [
        bufferToEtag(
          readFileSync(urlToFileSystemPath(resolveUrl("out/groupMap.json", metaFileUrl))),
        ),
        bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("../file.cjs", metaFileUrl)))),
      ],
      assets: ["file.cjs.map"],
      assetsEtag: [
        bufferToEtag(readFileSync(urlToFileSystemPath(resolveUrl("file.cjs.map", metaFileUrl)))),
      ],
      createdMs: actual.createdMs,
      lastModifiedMs: actual.lastModifiedMs,
    }
    assert({ actual, expected })
  }
  {
    // eslint-disable-next-line import/no-dynamic-require
    const actual = typeof require(urlToFileSystemPath(compiledFileUrl)).value
    const expected = "object"
    assert({ actual, expected })
  }

  // ensure serveBundle cache works
  const secondResponse = await serveBuild({
    ...serveBuildParams,
    request: {
      ...serveBuildParams.request,
      headers: {
        ...(compileCacheStrategy === "etag"
          ? { "if-none-match": response.headers.eTag }
          : {
              "if-modified-since": response.headers["last-modified"],
            }),
      },
    },
  })
  const actual = secondResponse.status
  const expected = 304
  assert({ actual, expected })
}, Promise.resolve())
