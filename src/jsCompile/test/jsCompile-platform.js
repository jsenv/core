import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { jsCompile } from "../jsCompile.js"

const file = `node_modules/dev-server/src/platform/browser/index.js`
const fileAbsolute = `${localRoot}/src/platform/browser/index.js`
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},

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
})

/*
depuis dev-server-poc

on fera donc

node_module/dev-server/src/platform/browser/index.js

ce qui fera locate et trouvera le fichier dans 'node_module/dev-server/src/platform/browser/index.js'
voir ailleurs en fait, l'important c'est le file de depart

ensuite donc le sourcemap devra indiquer le file, ca ok
et il devra dire ou sont ses sources
elle devront indiquer node_module/dev-server/src/platform/dependency.js par ex

a verifier

const selfLocalRoot =
  "/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server-poc/node_modules/dev-server"
const projectLocalRoot = "/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server-poc"
const selfFolder = selfLocalRoot.slice(projectLocalRoot.length + 1)

resolveSource: (source) => {
    if (source.indexOf("project-structure") > -1) {
      debugger
    }
    // source is relative to selfLocalRoot
    // so I must resolve as if I was on selfLocalRoot
    // then make it relative to localRoot
    const sourceAbsolute = path.resolve(selfLocalRoot, source)
    const sourceRelative = path.relative(selfLocalRoot, sourceAbsolute)
    const resolved = path.resolve(sourceRelative, selfLocalRoot)
    // faut refaire relative bordel de merde
    return resolved
  }
*/

jsCompile({
  localRoot,
  file,
  fileAbsolute,
  pluginMap,
}).then(({ sources, sourcesContent, assets, assetsContent, output }) => {
  assert({ actual: Array.isArray(sources), expected: true })
  assert({ actual: Array.isArray(sourcesContent), expected: true })
  assert({ actual: assets, expected: ["index.js.map"] })
  const map = JSON.parse(assetsContent)
  assert({ actual: map.file, expected: "node_modules/dev-server/src/platform/browser/index.js" })
  assert({ actual: typeof output, expected: "string" })
  console.log("passed")
})
