import { compileToCompileFile } from "./compileToCompileFile.js"
import path from "path"
import assert from "assert"

const projectRoot = path.resolve(__dirname, "../../../")
const localRoot = `${projectRoot}/src/compileToCompileFile/fixtures`
const compileInto = "build"
const compileId = "group"
const output = "foo"
const compileParamMap = {
  [compileId]: {
    content: output,
  },
}
const assetMap = {
  "asset.map": "bar",
}
const file = "src/file.txt"
const expectedEtag = `"3-C+7Hteo/D9vJXQ3UfzxbwnXaijM"`
const expectedOutputName = `${compileInto}/${compileId}/${file}`
let callCount = 0

const compile = ({ content }) => {
  callCount++
  return {
    outputSource: content,
    assetMap,
  }
}

const compileFile = compileToCompileFile(compile, {
  localRoot,
  compileInto,
})

compileFile({
  compileId,
  compileParamMap,
  file,
  cacheIgnore: true,
}).then((actual) => {
  assert.deepEqual(actual, {
    eTagValid: false,
    outputName: expectedOutputName,
    eTag: expectedEtag,
    output,
    assetMap,
  })

  return compileFile({
    compileId,
    compileParamMap,
    file,
    cacheIgnore: false,
  }).then((actual) => {
    assert.equal(callCount, 1)
    assert.deepEqual(actual, {
      eTagValid: false,
      outputName: expectedOutputName,
      eTag: expectedEtag,
      output,
      assetMap,
    })

    return compileFile({
      compileId,
      compileParamMap,
      file,
      cacheIgnore: false,
      eTag: expectedEtag,
    }).then((actual) => {
      assert.equal(callCount, 1)
      assert.deepEqual(actual, {
        eTagValid: true,
        outputName: expectedOutputName,
        eTag: expectedEtag,
        output,
        assetMap,
      })

      console.log("passed")
    })
  })
})
