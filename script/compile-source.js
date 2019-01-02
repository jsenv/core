const { patternGroupToMetaMap, forEachRessourceMatching } = require("@dmail/project-structure")
const {
  compileFile,
  fileSystemWriteCompileResult,
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
} = require("@dmail/project-structure-compile-babel")
const { localRoot } = require("./util.js")

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-commonjs": {},
  "syntax-dynamic-import": {},

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

const plugins = pluginMapToPluginsForPlatform(pluginMap, "node", "8.0.0")

const metaMap = patternGroupToMetaMap({
  compile: {
    "**/*.js": true,
    "**/*.js/**": false,
    "src/__test__/file-with-syntax-error.js": false,
    node_modules: false, // eslint-disable-line camelcase
    dist: false,
    script: false,
    ".eslintrc.js": false,
    "prettier.config.js": false,
  },
})

const outputFolder = `dist`

module.exports = forEachRessourceMatching({
  localRoot,
  metaMap,
  predicate: ({ compile }) => compile,
  callback: async (ressource) => {
    // we should have an option so that when file contains a syntaxError
    // it is not a problem, the file is copied with the syntaxError
    // and is not transpiled because
    // some file needs to be in dist with the syntaxError
    // for testing
    const { code, map } = await compileFile(ressource, {
      localRoot,
      plugins,
    })
    await fileSystemWriteCompileResult(
      {
        code,
        map,
      },
      {
        localRoot,
        outputFile: ressource,
        outputFolder,
      },
    )
    console.log(`${ressource} -> ${outputFolder}/${ressource}`)
  },
})
