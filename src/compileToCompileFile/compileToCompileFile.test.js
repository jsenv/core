import { compileToCompileFile } from "./compileToCompileFile.js"
import path from "path"
import assert from "assert"

const projectRoot = path.resolve(__dirname, "../../../")
const root = `${projectRoot}/src/compileToCompileFile/fixtures`
const into = "build"
const group = "group"
const output = "foo"
const groupParams = { content: output }
const assetMap = {
  "asset.map": "bar",
}
const file = "src/file.txt"
const expectedEtag = `"3-C+7Hteo/D9vJXQ3UfzxbwnXaijM"`
const expectedOutputName = `${into}/${group}/${file}`
let callCount = 0

const compile = ({ content }) => {
  callCount++
  return {
    output: content,
    assetMap,
  }
}

const compileFile = compileToCompileFile(compile, {
  root,
  into,
  group,
  groupParams,
})

compileFile({ file: "src/file.txt", cacheIgnore: true }).then((actual) => {
  assert.deepEqual(actual, {
    eTagValid: false,
    outputName: expectedOutputName,
    eTag: expectedEtag,
    output,
    assetMap,
  })

  return compileFile({ file: "src/file.txt", cacheIgnore: false }).then((actual) => {
    assert.equal(callCount, 1)
    assert.deepEqual(actual, {
      eTagValid: false,
      outputName: expectedOutputName,
      eTag: expectedEtag,
      output,
      assetMap,
    })

    return compileFile({ file: "src/file.txt", cacheIgnore: false, eTag: expectedEtag }).then(
      (actual) => {
        assert.equal(callCount, 1)
        assert.deepEqual(actual, {
          eTagValid: true,
          outputName: expectedOutputName,
          eTag: expectedEtag,
          output,
          assetMap,
        })

        console.log("passed")
      },
    )
  })
})
