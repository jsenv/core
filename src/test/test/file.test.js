import transformModulesSystemJs from "../../babel-plugin-transform-modules-systemjs/index.js"
import { localRoot } from "../../localRoot.js"
import { launchNode } from "../../launchNode/index.js"
import { launchChromium } from "../../launchChromium/index.js"
import { test } from "../test.js"

const launchChromiumWithUI = (options) => launchChromium({ ...options, headless: false })

const testPatternMapping = {
  "src/test/test/file.js": {
    node: {
      launch: launchNode,
    },
    chromium: {
      launch: launchChromiumWithUI,
    },
  },
}

test({
  localRoot,
  compileInto: "build",
  pluginMap: {
    "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
  },
  testPatternMapping,
})
