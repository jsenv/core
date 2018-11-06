import path from "path"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { createExecuteOnChromium } from "../createExecuteOnChromium/createExecuteOnChromium.js"
import { testDescriptorToCoverageMapForProject } from "./testDescriptorToCoverageMapForProject.js"
import { createCancel } from "../cancel/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "dist"
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
  debugger
})
