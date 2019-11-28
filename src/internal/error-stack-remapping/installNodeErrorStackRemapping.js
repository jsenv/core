import { fetchUrl } from "internal/fetchUrl.js"
import { installErrorStackRemapping } from "./installErrorStackRemapping.js"

const { SourceMapConsumer } = import.meta.require("source-map")

export const installNodeErrorStackRemapping = ({ resolveHref, indent } = {}) =>
  installErrorStackRemapping({
    resolveHref,
    fetchHref: fetchUrl,
    SourceMapConsumer,
    base64ToString,
    indent,
  })

const base64ToString = (base64String) => new Buffer(base64String, "base64").toString("utf8")
