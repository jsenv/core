// eslint-disable-next-line import/no-unresolved
import { applyTransform } from "jscodeshift/dist/testUtils.js"
import { createRequire } from "node:module"
import { asCompilationResult } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compilation_result.js"

const require = createRequire(import.meta.url)

export const convertCommonJsWithRecast = ({
  code,
  url,
  compiledUrl,
  projectDirectoryUrl,

  sourcemapExcludeSources,
}) => {
  // eslint-disable-next-line import/no-unresolved
  const cjsToEsModule = require("commonjs-to-es-module-codemod")

  const output = applyTransform(cjsToEsModule, {}, { source: code })

  return asCompilationResult(
    {
      contentType: "application/javascript",
      code: output,
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
