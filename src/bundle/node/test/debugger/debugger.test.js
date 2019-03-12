import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

const projectFolder = `${selfProjectFolder}/src/bundle/node/test/debugger`

bundleNode({
  projectFolder,
  into: "dist/node",
  entryPointObject: {
    main: "debugger.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
