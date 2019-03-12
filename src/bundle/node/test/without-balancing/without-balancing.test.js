import blockScoping from "@babel/plugin-transform-block-scoping"
import { projectFolder as selfProjectFolder } from "../../../../projectFolder.js"
import { bundleNode } from "../../bundleNode.js"

const projectFolder = `${selfProjectFolder}/src/bundle/node/test/without-balancing`

bundleNode({
  projectFolder,
  into: "dist/node",
  entryPointsDescription: {
    main: "without-balancing.js",
  },
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  verbose: true,
})
