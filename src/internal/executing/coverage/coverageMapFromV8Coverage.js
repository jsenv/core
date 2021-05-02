import { readDirectory } from "@jsenv/util"
// import { require } from "./internal/require.js"

// const v8ToIstanbul = require("v8-to-istanbul")

export const coverageMapFromV8Coverage = async ({ env, coverageConfig }) => {
  const { NODE_V8_COVERAGE } = env

  console.log(coverageConfig)
  const dirContent = await readDirectory(NODE_V8_COVERAGE)
  return {}
}
