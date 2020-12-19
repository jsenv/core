import { resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const sass = require("sass")

const scssUrl = resolveUrl("./file.scss", import.meta.url)
const scssOutUrl = resolveUrl("./dist/file.scss", import.meta.url)

const result = sass.renderSync({
  file: urlToFileSystemPath(scssUrl),
  outFile: urlToFileSystemPath(scssOutUrl),
  sourceMap: true,
  sourceMapContents: true,
})
const css = String(result.css)
const map = JSON.parse(String(result.map))
debugger
