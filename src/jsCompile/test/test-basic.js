import fs from "fs"
import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot as projectRoot } from "../../localRoot.js"
import { jsCompile } from "../jsCompile.js"

const localRoot = `${projectRoot}/src/jsCompile/test/fixtures`
const file = "file.js"
const fileAbsolute = `${localRoot}/${file}`
const input = fs.readFileSync(fileAbsolute).toString()
const pluginMap = pluginOptionMapToPluginMap({
  "transform-block-scoping": {},
})

const test = async () => {
  const { sources, sourcesContent, assets, assetsContent, output } = await jsCompile({
    localRoot,
    file,
    fileAbsolute,
    input,
    pluginMap,
  })

  assert({ actual: sources, expected: [file] })
  assert({ actual: sourcesContent, expected: [input] })
  assert({ actual: assets, expected: ["file.js.map"] })

  const map = JSON.parse(assetsContent[0])
  assert({
    actual: map,
    expected: {
      ...map,
      sources: [`/${file}`],
      version: 3,
    },
  })

  assert({ actual: typeof output, expected: "string" })
  assert({ actual: output.indexOf("var value = true"), expected: 0 })

  console.log("passed")
}

test()
