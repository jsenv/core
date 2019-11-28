import { fetchUrl } from "internal/fetchUrl.js"
import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

const { SourceMapConsumer } = import.meta.require("source-map")

export const installNodeErrorStackRemapping = ({ resolveHref, indent } = {}) =>
  installErrorStackRemapping({
    resolveHref,
    SourceMapConsumer,
    indent,
    fetchUrl,
  })
