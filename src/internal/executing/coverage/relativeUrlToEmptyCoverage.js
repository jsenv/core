import { createOperation } from "@jsenv/cancellation"
import { readFileContent } from "internal/filesystemUtils.js"
import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { createInstrumentBabelPlugin } from "./createInstrumentBabelPlugin.js"
import { createEmptyCoverage } from "./createEmptyCoverage.js"

const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")
const { transformAsync } = import.meta.require("@babel/core")

export const relativeUrlToEmptyCoverage = async (
  relativeUrl,
  { cancellationToken, projectDirectoryUrl, babelPluginMap },
) => {
  const fileUrl = resolveUrl(relativeUrl, projectDirectoryUrl)
  const filePath = urlToFileSystemPath(fileUrl)
  const source = await createOperation({
    cancellationToken,
    start: () => readFileContent(filePath),
  })

  // we must compile to get the coverage object
  // without evaluating the file because it would increment coverage
  // and execute code that can be doing anything

  try {
    const { metadata } = await createOperation({
      cancellationToken,
      start: () =>
        transformAsync(source, {
          filename: filePath,
          filenameRelative: relativeUrl,
          configFile: false,
          babelrc: false,
          parserOpts: {
            allowAwaitOutsideFunction: true,
          },
          plugins: [
            syntaxDynamicImport,
            syntaxImportMeta,
            ...Object.keys(babelPluginMap).map(
              (babelPluginName) => babelPluginMap[babelPluginName],
            ),
            createInstrumentBabelPlugin({ predicate: () => true }),
          ],
        }),
    })

    const { coverage } = metadata
    if (!coverage) {
      throw new Error(`missing coverage for file`)
    }

    // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229
    Object.keys(coverage.s).forEach(function(key) {
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
