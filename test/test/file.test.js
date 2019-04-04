import { launchNode, launchChromium, test } from "../../index.js"

const { projectFolder } = import.meta.require("../../jsenv.config.js")

const testFolder = `${projectFolder}/test/test`

const launchChromiumWithUI = (options) => launchChromium({ ...options, headless: false })

const testDescription = {
  "/file.js": {
    node: {
      launch: launchNode,
    },
    chromium: {
      launch: launchChromiumWithUI,
    },
  },
}

test({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  executeDescription: testDescription,
})
