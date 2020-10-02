import { resolveUrl, readFile } from "@jsenv/util"
import { transformCss } from "../transformCss.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const css = await readFile(cssFileUrl)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const bundleDirectoryUrl = resolveUrl("./dist/systemjs/", import.meta.url)
const result = await transformCss(css, {
  fileUrl: cssFileUrl,
  projectDirectoryUrl,
  bundleDirectoryUrl,
})
console.log(result)
