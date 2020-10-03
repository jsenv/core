import { resolveUrl, readFile } from "@jsenv/util"
import { collectCssUrls } from "../collectCssUrls.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const css = await readFile(cssFileUrl)
const result = await collectCssUrls(css, cssFileUrl, projectDirectoryUrl)
console.log(result)
