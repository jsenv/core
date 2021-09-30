import { readFileSync } from "node:fs"
import { urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

const { transformSync } = require("@babel/core")
const transformBlockScoping = require("@babel/plugin-transform-block-scoping")

export const getSourcemap = (jsFileUrl) => {
  const jsFileContent = readFileSync(jsFileUrl)

  const { code, map } = transformSync(jsFileContent, {
    filename: urlToFileSystemPath(jsFileUrl),
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: false,
    sourceMaps: true,
    // sourceFileName: scriptPath,
    plugins: [[transformBlockScoping, {}]],
  })

  console.log(code)
  console.log(JSON.stringify(map, null, "  "))

  return { code, map }
}
