import { createRequire } from "module"

import { urlToFileSystemPath } from "@jsenv/filesystem"

import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"

const require = createRequire(import.meta.url)

export const compileScss = ({
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,

  sourcemapExcludeSources,
}) => {
  const sass = require("sass")

  const result = sass.renderSync({
    file: urlToFileSystemPath(url),
    data: code,
    outFile: urlToFileSystemPath(compiledUrl),
    sourceMap: true,
    sourceMapContents: true,
  })

  return transformResultToCompilationResult(
    {
      contentType: "text/css",
      code: String(result.css),
      map: JSON.parse(String(result.map)),
    },
    {
      projectDirectoryUrl,
      originalFileContent: code,
      originalFileUrl: url,
      compiledFileUrl: compiledUrl,
      sourcemapFileUrl: `${compiledUrl}.map`,
      sourcemapExcludeSources,
    },
  )
}
