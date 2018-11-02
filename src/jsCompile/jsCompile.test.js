import { jsCompile } from "./jsCompile.js"
import fs from "fs"
import path from "path"
import assert from "assert"

const root = path.resolve(__dirname, "../../../")
const file = "src/jsCompile/fixtures/file.js"
const filename = `${root}/${file}`
const inputSource = fs.readFileSync(filename).toString()

jsCompile({
  root,
  inputName: file,
  inputSource,
  plugins: [],
  outputName: "dist/src/jsCompile/file.compiled.js",
}).then(({ outputSource, assetMap }) => {
  assert.equal(typeof outputSource, "string")
  assert.equal(outputSource.length > 0, true)
  assert.equal("file.js.map" in assetMap, true)
  const sourceMap = JSON.parse(assetMap["file.js.map"])
  assert.equal(sourceMap.file, file)
  assert.deepEqual(sourceMap.sources, [`/${file}`])
  console.log("passed")
})
