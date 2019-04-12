import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleNode({
  projectFolder: testFolder,
  entryPointMap: {
    main: "https.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
})
