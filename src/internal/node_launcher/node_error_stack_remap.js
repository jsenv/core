import { ensureWindowsDriveLetter, resolveUrl } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { installErrorStackRemapping } from "@jsenv/core/src/internal/error_stack_remap/install_error_stack_remapping.js"

import { fetchSource } from "./fetch_source.js"

export const installNodeErrorStackRemapping = ({
  projectDirectoryUrl,
  ...options
}) => {
  const { SourceMapConsumer } = require("source-map")

  return installErrorStackRemapping({
    SourceMapConsumer,
    fetchFile: fetchSource,
    resolveFile: (specifier, importer = projectDirectoryUrl) => {
      return ensureWindowsDriveLetter(resolveUrl(specifier, importer), importer)
    },
    ...options,
  })
}
