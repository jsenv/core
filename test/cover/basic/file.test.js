import { assert } from "/node_modules/@dmail/assert/index.js"
import { cover, launchNode, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/cover/basic`
const compileInto = ".dist"

;(async () => {
  const { coverageMap } = await cover({
    projectFolder: testFolder,
    compileInto,
    babelConfigMap: {},
    coverDescription: {
      "/file.js": true,
    },
    executeDescription: {
      "/use-file.js": {
        node: {
          launch: launchNode,
        },
        chromium: {
          launch: launchChromium,
        },
      },
    },
  })
  assert({
    actual: coverageMap,
    expected: {
      "file.js": {
        ...coverageMap["file.js"],
        s: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 0 },
      },
    },
  })
})()
