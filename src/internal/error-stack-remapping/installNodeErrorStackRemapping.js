import { require } from "internal/require.js"
import { ensureWindowsDriveLetter, resolveUrl } from "@jsenv/util"
import { fetchUrl } from "internal/fetchUrl.js"
import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

const { SourceMapConsumer } = require("source-map")

export const installNodeErrorStackRemapping = ({ projectDirectoryUrl, ...options }) =>
  installErrorStackRemapping({
    SourceMapConsumer,
    fetchFile: fetchUrl,
    resolveFile: (specifier, importer = projectDirectoryUrl) => {
      return ensureWindowsDriveLetter(resolveUrl(specifier, importer), importer)
    },
    ...options,
  })
