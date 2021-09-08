import { readFileSync } from "fs"
import { urlToFileSystemPath } from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"

const { transformSync } = require("@babel/core")
const transformBlockScoping = require("@babel/plugin-transform-block-scoping")

const jsUrl = new URL("./index.js", import.meta.url)
const jsContent = readFileSync(jsUrl)

const { code, map } = transformSync(jsContent, {
  filename: urlToFileSystemPath(jsUrl),
  configFile: false,
  babelrc: false, // trust only these options, do not read any babelrc config file
  ast: false,
  sourceMaps: true,
  // sourceFileName: scriptPath,
  plugins: [[transformBlockScoping, {}]],
})

console.log(code)
console.log(JSON.stringify(map, null, "  "))
