const { transformAsync } = require("@babel/core")
const {
  namedValueDescriptionToMetaDescription,
  selectAllFileInsideFolder,
} = require("@dmail/project-structure")
const {
  fileSystemWriteCompileResult,
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
} = require("@dmail/project-structure-compile-babel")
const { fileRead, fileWrite, fileCopy } = require("@dmail/helper")
const { projectFolder } = require("../projectFolder.js")

const babelPluginDescription = pluginOptionMapToPluginMap({
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

const babelPluginArray = pluginMapToPluginsForPlatform(babelPluginDescription, "node", "8.0.0")

const metaDescription = namedValueDescriptionToMetaDescription({
  compile: {
    "/**/*.js": true,
    "/**/*.json": "copy",
    "/node_modules/": false,
    "/**/dist/": false,
    "/**/.dist/": false,
    "/script/": false,
    "/.vscode/": false,
    "/sourceMapTest": false,
    "/.eslintrc.js": false,
    "/prettier.config.js": false,
    "/package.json": false,
    "/package-lock.json": false,
  },
})

const outputFolder = `dist`

module.exports = selectAllFileInsideFolder({
  pathname: projectFolder,
  metaDescription,
  predicate: ({ compile }) => compile,
  transformFile: async ({ filenameRelative, meta }) => {
    const filename = `${projectFolder}/${filenameRelative}`

    if (meta.compile === "copy") {
      await fileCopy(filename, `${projectFolder}/${outputFolder}/${filenameRelative}`)
      return
    }

    const source = await fileRead(filename)

    try {
      const { code, map } = await transformAsync(source, {
        plugins: babelPluginArray,
        filenameRelative,
        filename,
        sourceMaps: true,
        sourceFileName: filenameRelative,
      })

      await fileSystemWriteCompileResult(
        {
          code,
          map,
        },
        {
          localRoot: projectFolder,
          outputFile: filenameRelative,
          outputFolder,
        },
      )
      console.log(`${filenameRelative} -> ${outputFolder}/${filenameRelative}`)
    } catch (e) {
      if (e && e.code === "BABEL_PARSE_ERROR") {
        console.warn(`syntax error in ${filenameRelative}`)
        await fileWrite(`${projectFolder}/${outputFolder}/${filenameRelative}`, source)
        console.log(`${filenameRelative} -> ${outputFolder}/${filenameRelative}`)
      } else {
        throw e
      }
    }
  },
})
