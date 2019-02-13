import blockScoping from "@babel/plugin-transform-block-scoping"
import { root } from "../../../../root.js"
import { bundleBrowser } from "../../bundleBrowser.js"

bundleBrowser({
  entryPointObject: {
    main: "src/bundle/browser/test/basic/basic.js",
  },
  root,
  globalName: "basic",
  babelPluginDescription: {
    "transform-block-scoping": [blockScoping],
  },
})
