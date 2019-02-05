import transformModulesSystemJs from "../../babel-plugin-transform-modules-systemjs/index.js"
import { localRoot } from "../../localRoot.js"
import { launchChromium } from "../../launchChromium/index.js"
import { execute } from "../execute.js"

execute({
  file: "src/execute/test/file.js",
  localRoot,
  compileInto: "build",
  pluginMap: {
    "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
  },
  launch: launchChromium,
  stopOnceExecuted: true,
})
