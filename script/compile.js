const { compileFileStructure } = require("@dmail/project-structure-compile-babel")
const path = require("path")

compileFileStructure({
  root: path.resolve(__dirname, "../"),
  config: "structure.config.js",
  predicate: ({ compile }) => compile,
  into: "dist",
  platformName: "node",
  platformVersion: "8.0",
  moduleOutput: "commonjs",
})
