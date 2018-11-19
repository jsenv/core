const { forEachRessourceMatching, configToMetaMap } = require("@dmail/project-structure")
const {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
  compileFile,
  writeCompileResultInto,
} = require("@dmail/project-structure-compile-babel")
const structureConfig = require("../structure.config.js")
const path = require("path")

const localRoot = path.resolve(__dirname, "../")

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-commonjs": {},

  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
  "transform-block-scoped-functions": {},
  "transform-block-scoping": {},
  "transform-computed-properties": {},
  "transform-destructuring": {},
  "transform-dotall-regex": {},
  "transform-duplicate-keys": {},
  "transform-exponentiation-operator": {},
  "transform-function-name": {},
  "transform-literals": {},
  "transform-parameters": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
})
const plugins = pluginMapToPluginsForPlatform(pluginMap, "node", "8.0")

forEachRessourceMatching(
  localRoot,
  configToMetaMap(structureConfig),
  ({ compile }) => compile,
  async (ressource) => {
    const compileResult = await compileFile(ressource, { localRoot, plugins })
    await writeCompileResultInto(ressource, compileResult, { localRoot, into: "dist" })
    console.log(`${ressource} -> dist/${ressource} `)
  },
)
