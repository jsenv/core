import { assert } from "@dmail/assert"
import { localRoot } from "../../localRoot.js"
import { launchNode } from "../../launchNode/index.js"
import { launchChromium } from "../../launchChromium/index.js"
import { cover } from "../cover.js"

cover({
  localRoot,
  compileInto: "build",
  executePatternMapping: {
    "src/cover/test/use-file.js": {
      node: {
        launch: launchNode,
      },
      chromium: {
        launch: launchChromium,
      },
    },
  },
  coverPatternMapping: {
    "src/cover/test/file.js": true,
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
