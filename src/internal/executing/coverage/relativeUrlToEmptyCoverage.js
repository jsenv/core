import { resolveUrl, urlToFileSystemPath, readFile } from "@jsenv/filesystem"

import {
  babelPluginsFromBabelPluginMap,
  getMinimalBabelPluginMap,
} from "@jsenv/core/src/internal/compiling/babel_plugins.js"
import { babelPluginInstrument } from "./babel_plugin_instrument.js"
import { createEmptyCoverage } from "./createEmptyCoverage.js"

export const relativeUrlToEmptyCoverage = async (
  relativeUrl,
  { multipleExecutionsOperation, projectDirectoryUrl, babelPluginMap },
) => {
  const { transformAsync } = await import("@babel/core")

  const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)
  multipleExecutionsOperation.throwIfAborted()
  const source = await readFile(fileUrl)

  try {
    babelPluginMap = {
      ...getMinimalBabelPluginMap(),
      ...babelPluginMap,
      "transform-instrument": [babelPluginInstrument, { projectDirectoryUrl }],
    }

    multipleExecutionsOperation.throwIfAborted()
    const { metadata } = await transformAsync(source, {
      filename: urlToFileSystemPath(fileUrl),
      filenameRelative: relativeUrl,
      configFile: false,
      babelrc: false,
      ast: true,
      parserOpts: {
        allowAwaitOutsideFunction: true,
      },
      plugins: babelPluginsFromBabelPluginMap(babelPluginMap),
    })

    const { coverage } = metadata
    if (!coverage) {
      throw new Error(`missing coverage for file`)
    }

    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function (key) {
      coverage.s[key] = 0
    })

    return coverage
  } catch (e) {
    if (e && e.code === "BABEL_PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      return createEmptyCoverage(relativeUrl)
    }
    throw e
  }
}
