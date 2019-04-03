import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { jsCompile } from "../../jsCompile.js"

const transformBlockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/jsCompile/test/basic`
const filenameRelative = "basic.js"
const filename = `${testFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelConfigMap = {
  "transform-block-scoping": [transformBlockScoping],
}

const test = async () => {
  const { sources, sourcesContent, assets, assetsContent, output } = await jsCompile({
    input,
    filename,
    filenameRelative,
    projectFolder: testFolder,
    babelConfigMap,
  })

  assert({ actual: sources, expected: [filenameRelative] })
  assert({ actual: sourcesContent, expected: [input] })
  assert({ actual: assets, expected: [`${filenameRelative}.map`] })

  const map = JSON.parse(assetsContent[0])
  assert({
    actual: map,
    expected: {
      ...map,
      sources: [`/${filenameRelative}`],
      version: 3,
    },
  })

  assert({ actual: typeof output, expected: "string" })
  assert({ actual: output.includes("var value"), expected: true })
}

test()
