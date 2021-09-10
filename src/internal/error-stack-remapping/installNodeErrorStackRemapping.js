import { ensureWindowsDriveLetter, resolveUrl } from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"
import { fetchUrl } from "../fetchUrl.js"
import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

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
