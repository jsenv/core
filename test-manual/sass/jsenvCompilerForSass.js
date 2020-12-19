import { urlToContentType } from "@jsenv/server"
import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"
import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"

const sass = require("sass")

export const jsenvCompilerForSass = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  writeOnFilesystem,
  sourcemapExcludeSources,
}) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "text/x-sass" && contentType !== "text/x-scss") {
    return null
  }

  return {
    compile: (originalFileContent) => {
      const result = sass.renderSync({
        file: urlToFileSystemPath(originalFileUrl),
        data: originalFileContent,
        outFile: urlToFileSystemPath(compiledFileUrl),
        sourceMap: true,
        sourceMapContents: true,
      })
      const css = String(result.css)
      const map = JSON.parse(String(result.map))

      const sourcemapFileUrl = `${compiledFileUrl}.map`
      return transformResultToCompilationResult(
        {
          code: css,
          map,
          contentType: "text/css",
        },
        {
          projectDirectoryUrl,
          originalFileContent,
          originalFileUrl,
          compiledFileUrl,
          sourcemapFileUrl,
          sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
          sourcemapExcludeSources,
        },
      )
    },
  }
}
