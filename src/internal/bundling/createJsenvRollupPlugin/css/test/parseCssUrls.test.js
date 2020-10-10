import { resolveUrl, readFile } from "@jsenv/util"
import { parseCssUrls } from "../parseCssUrls.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const css = await readFile(cssFileUrl)
const result = await parseCssUrls(css, cssFileUrl, projectDirectoryUrl)
console.log(result)
