import fs from "fs"
import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { jsCompile } from "../../jsCompile.js"

const projectFolder = `${selfProjectFolder}/src/jsCompile/test/basic`
const filenameRelative = "basic.js"
const filename = `${projectFolder}/${filenameRelative}`
const input = fs.readFileSync(filename).toString()
const babelPluginDescription = pluginOptionMapToPluginMap({
  "transform-block-scoping": {},
})

const test = async () => {
  const { sources, sourcesContent, assets, assetsContent, output } = await jsCompile({
    input,
    filename,
    filenameRelative,
    projectFolder,
    babelPluginDescription,
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
