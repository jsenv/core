import { startBrowsingServer } from "../../index.js"

const { projectFolder } = import.meta.require("../../jsenv.config.js")
const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

const testFolder = `${projectFolder}/test/browsing-server`

startBrowsingServer({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap,
  browsableDescription: {
    "/file.js": true,
    "/other-file.js": true,
  },
  port: 3400,
  forcePort: true,
})
