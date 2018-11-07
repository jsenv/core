import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { createExecuteOnChromium } from "../createExecuteOnChromium/createExecuteOnChromium.js"
import { testDescriptorToCoverageMapForProject } from "./testDescriptorToCoverageMapForProject.js"
import { createCancel } from "../cancel/index.js"
import assert from "assert"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const testDescriptor = {
  node: {
    createExecute: createExecuteOnNode,
    files: ["src/__test__/file.test.js"],
  },
  chromium: {
    createExecute: createExecuteOnChromium,
    files: [], // ["src/__test__/file.test.js"]
  },
}
const { cancellation } = createCancel()
testDescriptorToCoverageMapForProject(testDescriptor, {
  cancellation,
  localRoot,
  compileInto,
  watch,
}).then((coverageMap) => {
  assert.deepEqual(coverageMap["index.js"], {
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    path: "index.js",
    s: {},
    statementMap: {},
  })
  assert.deepEqual(coverageMap["src/__test__/file.js"].s, {
    0: 1,
    1: 1,
    2: 1,
  })
  console.log("passed")
})
