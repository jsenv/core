import { assert } from "@dmail/assert"
import { projectFolder } from "../../projectFolder.js"
import { launchNode } from "../../launchNode/index.js"
import { launchChromium } from "../../launchChromium/index.js"
import { cover } from "../cover.js"

cover({
  projectFolder,
  compileInto: "build",
  coverDescription: {
    "src/cover/test/file.js": true,
  },
  executeDescription: {
    "src/cover/test/use-file.js": {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
}).then((coverageMap) => {
  assert({
    actual: coverageMap,
    expected: {
      "src/cover/test/file.js": {
        ...coverageMap["src/cover/test/file.js"],
        s: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 0 },
      },
    },
  })
})
