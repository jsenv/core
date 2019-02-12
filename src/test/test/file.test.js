import { root } from "../../root.js"
import { launchNode } from "../../launchNode/index.js"
import { launchChromium } from "../../launchChromium/index.js"
import { test } from "../test.js"

const launchChromiumWithUI = (options) => launchChromium({ ...options, headless: false })

const testDescription = {
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
  root,
  compileInto: "build",
  pluginMap: {},
  executeDescription: testDescription,
})
