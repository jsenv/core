import { resolveUrl, readFile } from "@jsenv/util"
import { transformCss } from "../transformCss.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const css = await readFile(cssFileUrl)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const result = await transformCss(css, cssFileUrl, projectDirectoryUrl, { cssMinification: true })
console.log(result)
