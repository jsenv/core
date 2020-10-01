import { resolveUrl, readFile } from "@jsenv/util"
import { replaceCssUrls } from "../replaceCssUrls.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const css = await readFile(cssFileUrl)
const jsenvFileUrl = resolveUrl("./jsenv.png", import.meta.url)
const styleBFileUrl = resolveUrl("./style-b.css", import.meta.url)
const result = await replaceCssUrls(
  css,
  {
    [styleBFileUrl]: "./bar.css",
    [jsenvFileUrl]: "./foo.png",
  },
  {
    from: cssFileUrl,
    to: `${cssFileUrl}-2.css`,
    cssFileUrl,
  },
)
console.log(result)
