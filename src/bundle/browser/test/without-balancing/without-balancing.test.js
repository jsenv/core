// import blockScoping from "@babel/plugin-transform-block-scoping"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { projectFolder as selfProjectFolder } from "../../../../../projectFolder.js"
import { bundleBrowser } from "../../bundleBrowser.js"

const projectFolder = `${selfProjectFolder}/src/bundle/browser/test/without-balancing`

bundleBrowser({
  projectFolder,
  into: "dist/browser",
  globalName: "withoutBalancing",
  entryPointsDescription: {
    main: "without-balancing.js",
  },
  babelPluginDescription: pluginOptionMapToPluginMap({
    "proposal-async-generator-functions": {},
    "proposal-json-strings": {},
    "proposal-object-rest-spread": {},
    "proposal-optional-catch-binding": {},
    "proposal-unicode-property-regex": {},
    "transform-arrow-functions": {},
    "transform-async-to-generator": {},
    "transform-block-scoped-functions": {},
    "transform-block-scoping": {},
    "transform-classes": {},
    "transform-computed-properties": {},
    "transform-destructuring": {},
    "transform-dotall-regex": {},
    "transform-duplicate-keys": {},
    "transform-exponentiation-operator": {},
    "transform-for-of": {},
    "transform-function-name": {},
    "transform-literals": {},
    "transform-new-target": {},
    "transform-object-super": {},
    "transform-parameters": {},
    "transform-regenerator": {},
    "transform-shorthand-properties": {},
    "transform-spread": {},
    "transform-sticky-regex": {},
    "transform-template-literals": {},
    "transform-typeof-symbol": {},
    "transform-unicode-regex": {},
  }),
  verbose: true,
})
