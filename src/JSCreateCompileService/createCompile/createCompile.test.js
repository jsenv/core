import { createCompile } from "./createCompile.js"
import fs from "fs"
import path from "path"
import assert from "assert"

const compileJS = createCompile({
  transpile: true,
})

const root = path.resolve(__dirname, "../../../")
const file = "src/jsCreateCompileService/createCompile/fixtures/file.js"
const filename = `${root}/${file}`

compileJS({
  root,
  inputName: file,
  inputSource: fs.readFileSync(filename).toString(),
  groupId: "nothing",
}).then(({ generate }) => {
  return generate({
    outputName: "dist/src/createCompile/file.compiled.js",
    getBabelPlugins: () => [],
  }).then(({ output, outputAssets }) => {
    assert.equal(typeof output, "string")
    assert.equal(outputAssets[0].name, "file.js.map")
    const sourceMap = JSON.parse(outputAssets[0].content)
    assert.equal(sourceMap.file, file)
    assert.deepEqual(sourceMap.sources, [`/${file}`])
    console.log("passed")
  })
})
