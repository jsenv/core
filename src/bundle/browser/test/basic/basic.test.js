import blockScoping from "@babel/plugin-transform-block-scoping"
import { localRoot } from "../../../../localRoot.js"
import { bundleBrowser } from "../../bundleBrowser.js"

bundleBrowser({
  root: localRoot,
  entryPointObject: {
    main: "src/bundle/browser/test/basic/basic.js",
  },
  globalName: "basic",
  pluginMap: {
    "transform-block-scoping": [blockScoping],
  },
})
