import { startBrowsingServer } from "../../index.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")
const { projectFolder } = import.meta.require("../../jsenv.config.js")

const testFolder = `${projectFolder}/test/browsing-server`

startBrowsingServer({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap,
  browsableDescription: {
    "/**/*.main.js": true,
    "/**/.dist/**": false,
  },
  port: 3400,
  forcePort: true,
})
