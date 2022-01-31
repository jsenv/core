import { ensureWindowsDriveLetter, resolveUrl } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { installErrorStackRemapping } from "@jsenv/core/src/internal/error_stack_remap/installErrorStackRemapping.js"

export const installNodeErrorStackRemapping = ({
  projectDirectoryUrl,
  ...options
}) => {
  const { SourceMapConsumer } = require("source-map")

  return installErrorStackRemapping({
    SourceMapConsumer,
    fetchFile: fetchUrl,
    resolveFile: (specifier, importer = projectDirectoryUrl) => {
      return ensureWindowsDriveLetter(resolveUrl(specifier, importer), importer)
    },
    ...options,
  })
}
