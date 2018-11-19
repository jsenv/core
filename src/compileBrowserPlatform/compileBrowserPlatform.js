const {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
  fileSystemWriteCompileResult,
} = require("@dmail/project-structure-compile-babel")
const path = require("path")

const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")
const nodeResolve = require("rollup-plugin-node-resolve")

const localRoot = path.resolve(__dirname, "../")
const inputFile = `src/platform/browser/index.js`
const pluginMap = pluginOptionMapToPluginMap({
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
  "transform-object-super": {},
  "transform-parameters": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
})

const compile = async () => {
  const plugins = pluginMapToPluginsForPlatform(pluginMap, "unknown", "0.0.0")
  const bundle = await rollup({
    input: `${localRoot}/${inputFile}`,
    plugins: [
      nodeResolve({
        module: true,
      }),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins,
      }),
    ],
    // skip rollup warnings
    onwarn: () => {},
  })
  const compileResult = await bundle.generate({
    format: "iife",
    name: "__browserPlatform__",
    sourcemap: true,
  })

  await fileSystemWriteCompileResult(compileResult, `browser-platform.js`, `${localRoot}/dist`)
  console.log(`${inputFile} -> dist/browser-platform.js`)
}

compile()
