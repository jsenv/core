const { transformAsync } = require("@babel/core")
const { patternGroupToMetaMap, forEachRessourceMatching } = require("@dmail/project-structure")
const {
  fileSystemWriteCompileResult,
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
} = require("@dmail/project-structure-compile-babel")
const { fileWriteFromString } = require("../dist/src/fileHelper.js")
const { localRoot } = require("./util.js")
const { readFile } = require("./readFile.js")

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
    node_modules: false, // eslint-disable-line camelcase
    dist: false,
    build: false,
    script: false,
    sourceMapTest: false,
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
    const source = await readFile(`${localRoot}/${ressource}`)

    try {
      const { code, map } = await transformAsync(source, {
        plugins,
        filenameRelative: ressource,
        filename: `${localRoot}/${ressource}`,
        sourceMaps: true,
        sourceFileName: ressource,
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
    } catch (e) {
      if (e && e.code === "BABEL_PARSE_ERROR") {
        console.warn(`syntax error in ${ressource}`)
        await fileWriteFromString(`${localRoot}/${outputFolder}/${ressource}`, source)
        console.log(`${ressource} -> ${outputFolder}/${ressource}`)
      } else {
        throw e
      }
    }
  },
})
