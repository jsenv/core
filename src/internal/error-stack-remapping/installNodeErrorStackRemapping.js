import { fetchUrl } from "internal/fetchUrl.js"
import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

const { SourceMapConsumer } = import.meta.require("source-map")

export const installNodeErrorStackRemapping = (options = {}) =>
  installErrorStackRemapping({
    SourceMapConsumer,
    fetchFile: fetchUrl,
    ...options,
  })
