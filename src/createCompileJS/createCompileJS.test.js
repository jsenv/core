import { createCompileJS } from "./createCompileJS.js"
import fs from "fs"
import path from "path"
import assert from "assert"

const compileJS = createCompileJS({
  createOptions: () => {
    return {
      transpile: true,
      instrument: false,
      remapMethod: "comment",
    }
  },
})

const root = path.resolve(__dirname, "../../../")
const file = "src/createCompileJS/file.js"
const filename = `${root}/${file}`

compileJS({
  root,
  inputName: file,
  inputSource: fs.readFileSync(filename).toString(),
  groupId: "nothing",
}).then(({ generate }) => {
  return generate({
    outputRelativeLocation: "file.compiled.js",
    getBabelPlugins: () => [],
  }).then(({ output, outputAssets }) => {
    assert.equal(typeof output, "string")
    assert.equal(outputAssets[0].name, "file.js.map")
    console.log("passed")
  })
})
